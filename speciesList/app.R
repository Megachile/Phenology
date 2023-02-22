library(pracma)
library(solrad)
# library(leaflet)
library(shiny)
library(dplyr)
library(shinyjs)
library(data.table)
library(DT)
library(RLumShiny)
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

# species_limits <- observations %>%
#   select(binom, latitude, longitude) %>%
#   group_by(binom) %>%
#   summarise(min_lat = min(latitude),
#             max_lat = max(latitude),
#             min_long = min(longitude),
#             max_long = max(longitude))

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

      checkboxInput("mode",label="Correct for latitude?", value=FALSE),
      div(id = "myPopover",
          popover("Explain", "Selecting this option filters by Season Index rather than day of year. Season Index is the percent of annual daylight hours at a given latitude that have accumulated by a given day. It excludes species emerging at the same date but much further north or south of your site of interest, and allows some extrapolation for species with limited data. However, at wider thresholds it overcorrects by lumping late fall and early spring galls together.")
      ),
      
      # popover("Explain", "Selecting this option filters by Season Index rather than day of year. Season Index is the percent of annual daylight hours at a given latitude that have accumulated by a given day. It excludes species emerging at the same date but much further north or south of your site of interest, and allows some extrapolation for species with limited data. However, at wider thresholds it overcorrects by lumping late fall and early spring galls together."),
      dateInput("date", label="Observation date (ignore year)", value =Sys.Date()),
      textInput("species",label="Search within results by character string", value = ""),
      radioButtons("gen",label="Filter by generation:", choices = c("sexgen","agamic","all"),selected = "all"),
      sliderInput("days", label="How many days before or after the observation do you want to look?", min = 1, max = 183, value = 10),
      sliderInput("thr", label="How far from the observation do you want to look?", min = 0.005, max = 0.5, value = 0.05),
      sliderInput("lat", label="What is the latitude of your site of interest?", min = 8, max=65, value = 40),
      # leafletOutput("map"),
      # sliderInput("latrange", label="How far north-south of your site do you want to look for matching species?", min = 10, max = 65, value = c(10, 65)),
      # sliderInput("longrange", label="How far east-west of your site do you want to look for matching species?", min = -140, max = -50, value = c(-140, -50))
    ),
    mainPanel(
    textOutput("species_count"),
    dataTableOutput("species"),
    downloadButton("downloadData", "Download as CSV")
    )
  )
)

server <- function(input, output) {
  # output$map <- renderLeaflet({
  #   leaflet() %>% addTiles()
  # })

  # observe({
  #   lat1 <- input$latrange[1]
  #   lat2 <- input$latrange[2]
  #   lng1 <- input$longrange[1]
  #   lng2 <- input$longrange[2]
  #   leafletProxy("map", data = "rect") %>%
  #     clearShapes() %>%
  #     addRectangles(lng1 = lng1, lat1 = lat1, lng2 = lng2, lat2 = lat2, layerId = "rect", color = "red", fillOpacity = 0.3)
  # })
  
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
  
  species_data <- reactive({
    
    if (input$mode) {
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
      result <- filtered_observations
      # filtered_species_limits <- species_limits %>%
      #   filter(min_lat >= min(input$latrange) & max_lat <= max(input$latrange)) %>%
      #   filter(min_long >= min(input$longrange) & max_long <= max(input$longrange))
      # 
      # result <- filtered_observations %>%
      #   inner_join(filtered_species_limits, by = c("binom" = "binom"))
  
      result <- result %>%
        mutate(link = paste0("<a href=", result$gfURL, ">", result$binom, "</a>"))
      
      display <- result %>%
        select(binom, link) %>%
        unique() %>%
        arrange(binom)
      
      return(data.frame(display))
    } else {

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
      result <- filtered_observations
      # filtered_species_limits <- species_limits %>%
      #   filter(min_lat >= min(input$latrange) & max_lat <= max(input$latrange)) %>%
      #   filter(min_long >= min(input$longrange) & max_long <= max(input$longrange))
      # 
      # result <- filtered_observations %>%
      #   inner_join(filtered_species_limits, by = c("binom" = "binom"))
      
      result <- result %>%
        mutate(link = paste0("<a href=", result$gfURL, ">", result$binom, "</a>"))
      
      display <- result %>%
        select(binom, link) %>%
        unique() %>%
        arrange(binom)
      
      return(data.frame(display))
    }
      
  })
  
  output$species_count <- renderText({
    if (nrow(species_data()) == 0) {
      "There are no matching species."
    } else {
      paste("There are", nrow(species_data()), "matching species.")
    }
  })
  
  output$species <- renderDT({
    if (nrow(species_data()) == 0) {
      NULL
    } else {
      data <- data.frame(species_data()$link)
      colnames(data) <- "Species"
      DT::datatable(data, rownames = FALSE, escape = FALSE)  
      }
  })

  output$downloadData <- 
    downloadHandler(
      filename = "specieslist.csv",
      content = function(file) {
        write.csv(species_data()$binom, file, row.names = FALSE)
      }
    )

}
shinyApp(ui = ui, server = server)