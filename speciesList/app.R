library(shiny)
library(shinyjs)
library(pracma)
library(solrad)
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
wd <- "C:/Users/adam/Documents/GitHub/Phenology"
setwd(wd)
# gallphen <- dbConnect(RSQLite::SQLite(), "gallphenReset.sqlite")
# observations <- dbGetQuery(gallphen, "SELECT observations.*, host.species AS host, gall.generation, gall.species, gall.genus FROM observations
#            LEFT JOIN species AS host ON observations.host_id = host.species_id
#            INNER JOIN species AS gall ON observations.gall_id = gall.species_id")
# observations$binom <- paste(observations$genus, observations$species)
# observations[observations$lifestage == "Adult"&observations$phenophase== "","phenophase"] <- "Adult"
# observations <- seasonIndex(observations)
# observations <- acchours(observations)
# write.csv(observations, file = "observations.csv", row.names = FALSE)
observations <- read.csv(paste0(wd, "/observations.csv" ))

ui <- fluidPage(
  useShinyjs(),
  # App title ----
  titlePanel("Known Emergences Near Date"),
  sidebarLayout(
    sidebarPanel(
      checkboxInput("mode",label="Extrapolate by seasind?", value=FALSE),
      helpText("Seasind compensates for limited data by extrapolating along linear doy-lat isoclines. Overcompensates in that it doesn't distinguish fall/winter."),
      dateInput("date", label="observation date (ignore year)"),
      textInput("species",label="Search within results by character string", value = ""),
      numericInput("days", label="how many days before or after the observation do you want to look?", value = 15),
      sliderInput("thr", label="how far from the observation do you want to look?", min = 0.005, max = 0.5005, value = 0.05),
      numericInput("lat", label="What latitude are you interested in?", value = 40),
      actionButton("button", "Go"),
    ),
    mainPanel(
    tableOutput("doyspecies"),
    tableOutput("sispecies"),
    )
  )
)

server <- function(input, output) {
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

  observeEvent(input$button, {
    output$doyspecies <- renderTable({
      if (input$mode) return()
      doy <- as.integer(format(as.Date(input$date),"%j"))
      min <- doy-input$days
      max <- doy+input$days
      mod <- 365
      doyrange <- btwmod(observations$doy, min, max, mod)
      sort(unique(observations[(grepl(input$species, observations$binom,ignore.case=TRUE)&observations$phenophase %in% c("maturing","perimature","Adult")&doyrange),"binom"])
    )})
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
      sort(unique(observations[(grepl(input$species, observations$binom,ignore.case=TRUE)&observations$phenophase %in% c("maturing","perimature","Adult")&sirange),"binom"])
      )})
  })
  
  
  
}
shinyApp(ui = ui, server = server)