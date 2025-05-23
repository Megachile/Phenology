library(shiny)
library(shinyjs)
library(pracma)
library(solrad)
library(dplyr)
library(leaflet)
pos_part <- function(x) {
  return(sapply(x, max, 0))
}
eq = function(x,lat=49) {((2*(24/(2*pi))*acos(-tan((lat*pi/180))*tan((pi*Declination(x)/180))))-(0.1*lat+5)) }
btwmod <- function(doy, min, max,mod){
  if (min<0|max>365){
    btw <- (doy >= (min %% mod)|doy <= (max %% mod))
  } else {
    btw <- (doy>=min&doy<=max)
  }
  return(btw)
}    
singlesi <- function(doy, lat){  
  trapz(seq(1,doy),(pos_part(eq(seq(1,doy),lat))))/trapz(seq(1,(365)),(pos_part(eq(seq(1,(365)),lat))))
}
observations <- read.csv("observations.csv")

species_limits <- observations %>%
  select(binom, latitude, longitude) %>%
  group_by(binom) %>%
  summarise(min_lat = min(latitude),
            max_lat = max(latitude),
            min_long = min(longitude),
            max_long = max(longitude))

# Define custom date processing function
format_date <- function(date) {
  format(date, "%m-%d")
}

ui <- fluidPage(
  useShinyjs(),
  # App title ----
  titlePanel("Known Emergences Near Date"),
  sidebarLayout(
    sidebarPanel(
      
      checkboxInput("mode",label="Extrapolate by seasind?", value=FALSE),
      # helpText("Seasind compensates for limited data by extrapolating along linear doy-lat isoclines. Overcompensates in that it doesn't distinguish fall/winter and will extrapolate species well outside their known ranges. Use lat and long limits below to compensate for that as desired."),
      dateInput("date", label="observation date (ignore year)", value ="2023-01-01"),
      textInput("species",label="Search within results by character string", value = ""),
      radioButtons("gen",label="Filter by generation:", choices = c("sexgen","agamic","all"),selected = "all"),
      sliderInput("days", label="how many days before or after the observation do you want to look?", min = 1, max = 183, value = 10),
      sliderInput("thr", label="how far from the observation do you want to look?", min = 0.005, max = 0.5005, value = 0.05),
      numericInput("lat", label="What is the latitude of your site of interest?", min = 10, max = 65, value = 40),
      leafletOutput("map"),
      sliderInput("latrange", label="How far north-south of your site do you want to look for matching species?", min = 10, max = 65, value = c(10, 65)),
      sliderInput("longrange", label="How far east-west of your site do you want to look for matching species?", min = -140, max = -50, value = c(-140, -50))
    ),
    mainPanel(
      textOutput("species_count"),
      dataTableOutput("species"),
      downloadButton("downloadData", "Download")
    )
  )
)

server <- function(input, output) {
  output$map <- renderLeaflet({
    leaflet() %>% addTiles()
  })
  
  observe({
    lat1 <- input$latrange[1]
    lat2 <- input$latrange[2]
    lng1 <- input$longrange[1]
    lng2 <- input$longrange[2]
    leafletProxy("map", data = "rect") %>%
      clearShapes() %>%
      addRectangles(lng1 = lng1, lat1 = lat1, lng2 = lng2, lat2 = lat2, layerId = "rect", color = "red", fillOpacity = 0.3)
  })
  
  observeEvent(input$mode, {
    if (input$mode) {
      show("thr")
      show("lat")
      hide("days")
    } else {
      hide("thr")
      hide("lat")
      show("days")
    }
  })
  
  observe({
    
    req(!input$mode)
    doy <- as.integer(format(as.Date(input$date),"%j"))
    min <- doy-input$days
    max <- doy+input$days
    mod <- 365
    doyrange <- btwmod(observations$doy, min, max, mod)
    
    if(input$gen %in% c("sexgen", "agamic")) {
      filtered_observations <- observations %>%
        filter(grepl(input$species, binom, ignore.case = TRUE) & phenophase %in% c("maturing", "perimature", "Adult") & doyrange & generation == input$gen)
    } else {
      filtered_observations <- observations %>%
        filter(grepl(input$species, binom, ignore.case = TRUE) & phenophase %in% c("maturing", "perimature", "Adult") & doyrange)
    }
    
    filtered_species_limits <- species_limits %>%
      filter(min_lat >= min(input$latrange) & max_lat <= max(input$latrange)) %>%
      filter(min_long >= min(input$longrange) & max_long <= max(input$longrange))
    
    result <- filtered_observations %>%
      inner_join(filtered_species_limits, by = c("binom" = "binom"))
    
    result <- result %>%
      mutate(link = paste0("<a href=", result$gfURL, ">", result$binom, "</a>"))
    
    display <- result %>%
      select(binom, link) %>%
      unique() %>%
      arrange(binom)
    
    if (nrow(display) == 0) {
      output$species_count <- renderText("There are no matching species.")
      output$species <- renderDT(NULL)
    } else {
      output$species_count <- renderText(paste("There are", nrow(display), "matching species."))
      output$species <- renderDT({
        DT::datatable(data.frame(display$link),   rownames = FALSE,
                      escape = FALSE)
      })
    }
  })
  
  observe({
    
    req(input$mode)
    doy <- as.integer(format(as.Date(input$date),"%j"))
    si <- singlesi(doy, input$lat)
    min <- si-input$thr
    max <- si+input$thr
    mod <- 1
    sirange <- btwmod(observations$seasind, min, max, mod)
    
    if(input$gen %in% c("sexgen", "agamic")) {
      filtered_observations <- observations %>%
        filter(grepl(input$species, binom, ignore.case = TRUE) & phenophase %in% c("maturing", "perimature", "Adult") & sirange & generation == input$gen)
    } else {
      filtered_observations <- observations %>%
        filter(grepl(input$species, binom, ignore.case = TRUE) & phenophase %in% c("maturing", "perimature", "Adult") & sirange)
    }
    
    filtered_species_limits <- species_limits %>%
      filter(min_lat >= min(input$latrange) & max_lat <= max(input$latrange)) %>%
      filter(min_long >= min(input$longrange) & max_long <= max(input$longrange))
    
    result <- filtered_observations %>%
      inner_join(filtered_species_limits, by = c("binom" = "binom"))
    
    result <- result %>%
      mutate(link = paste0("<a href=", result$gfURL, ">", result$binom, "</a>"))
    
    display <- result %>%
      select(binom, link) %>%
      unique() %>%
      arrange(binom)
    
    if (nrow(display) == 0) {
      output$species_count <- renderText("There are no matching species.")
      output$species <- renderDT(NULL)
    } else {
      output$species_count <- renderText(paste("There are", nrow(display), "matching species."))
      output$species <- renderDT({
        DT::datatable(data.frame(display$link),   rownames = FALSE,
                      escape = FALSE)
      })
    }
    
  })
  
  }
shinyApp(ui = ui, server = server)