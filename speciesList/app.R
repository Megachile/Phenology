library(shiny)
library(shinyjs)
library(pracma)
library(solrad)
library(dplyr)
library(leaflet)
# library(lubridate)
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



ui <- fluidPage(
  useShinyjs(),
  # App title ----
  titlePanel("Known Emergences Near Date"),
  sidebarLayout(
    sidebarPanel(
      checkboxInput("mode",label="Extrapolate by seasind?", value=FALSE),
      helpText("Seasind compensates for limited data by extrapolating along linear doy-lat isoclines. Overcompensates in that it doesn't distinguish fall/winter and will extrapolate species well outside their known ranges. Use lat and long limits below to compensate for that as desired."),
      dateInput("date", label="observation date (ignore year)"),
      textInput("species",label="Search within results by character string", value = ""),
      numericInput("days", label="how many days before or after the observation do you want to look?", value = 15),
      sliderInput("thr", label="how far from the observation do you want to look?", min = 0.005, max = 0.5005, value = 0.05),
      radioButtons("gen",label="Filter by generation:", choices = c("sexgen","agamic","all"),selected = "all"),
      numericInput("lat", label="What is the latitude of your site of interest?", min = 20, max = 55, value = 40),
      leafletOutput("map"),
      sliderInput("latrange", label="How far north-south of your site do you want to look for matching species?", min = 20, max = 55, value = c(20, 40)),
      sliderInput("longrange", label="How far east-west of your site do you want to look for matching species??", min = -125, max = -66, value = c(-125, -66)),
      actionButton("button", "Go"),
    ),
    mainPanel(
    tableOutput("doyspecies"),
    tableOutput("sispecies"),
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
      hide("days")
    } else {
      hide("thr")
      show("days")
    }
  })

  observeEvent(input$button, {
    output$doyspecies <- renderTable({
      if (input$mode) return()
      doy <- as.integer(format(as.Date(input$date),"%j"))
      min <- doy-input$days
      max <- doy+input$days
      mod <- 365
      doyrange <- btwmod(observations$doy, min, max, mod)
      # sort(unique(observations[(grepl(input$species, observations$binom,ignore.case=TRUE)&observations$phenophase %in% c("maturing","perimature","Adult")&doyrange),"binom"])
      
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
      
      result %>%
        select(binom) %>%
        unique() %>%
        arrange(binom) %>%
        pull(binom)
    })

  })
  
  observeEvent(input$button, {
    output$sispecies <- renderTable({
      if (!input$mode) return()
      doy <- as.integer(format(as.Date(input$date),"%j"))
      si <- singlesi(doy, input$lat) 
      min <- si-input$thr
      max <- si+input$thr
      mod <- 1
      sirange <- btwmod(observations$seasind, min, max, mod)
      # sort(unique(observations[(grepl(input$species, observations$binom,ignore.case=TRUE)&observations$phenophase %in% c("maturing","perimature","Adult")&sirange),"binom"])
      
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
      
      result %>%
        select(binom) %>%
        unique() %>%
        arrange(binom) %>%
        pull(binom)
  })
  })
  
  
  
}
shinyApp(ui = ui, server = server)