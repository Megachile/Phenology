# library(httpuv)
library(seleniumPipes)
library(RSelenium)
library(shiny)
library(shinyjs)
library(wdman)
library(httr)

remDr <- remoteDriver(
  browserName = "edge",
  port = 4445L,
  extraCapabilities = list(
    edgeOptions = list(
      args = c("disable-infobars"),
      binary = "C:\\Users\\adam\\Downloads\\edgedriver_win64\\msedgedriver.exe"
    )
  )
)

selServ <- selenium(port = 4445L, browserName = "edge")
remDr <- remoteDriver(browserName = "edge", port = 4445L)
remDr$open()

# Get the current URL of the active window
currentUrl <- remDr$getCurrentUrl()


# Navigate to a webpage
remDr$navigate("https://www.google.com")


  
# Define the JavaScript code to execute
jsCode <- "var obsIDPath = 'body > div:nth-child(21) > div.fade.ObservationModal.FullScreenModal.in.modal > div > div > div.inner > div.left-col > div.obs-modal-header > span > a.comname.display-name';
var obsIDElement = document.querySelector(obsIDPath);
if (obsIDElement) {
  var obsID = obsIDElement.getAttribute('href').split('/')[2];
  return obsID;
} else {
  return null;
}"

# Execute the JavaScript code on the active Edge window
obsID <- remDr$executeScript(jsCode)

# Print the result
print(obsID)
# 
# ui <- fluidPage(
#   useShinyjs(),
#   titlePanel("iNaturalist Annotation Helper"),
#   sidebarLayout(
#     sidebarPanel(
#       textInput("identify_url", "Identify Page URL", ""),
#       actionButton("get_obs_id", "Get Observation ID")
#     ),
#     mainPanel(
#       textOutput("observation_id")
#     )
#   )
# )
# 
# server <- function(input, output, session) {
#   observe({
#     query <- parseQueryString(session$clientData$url_search)
#     if (!is.null(query[['observation_id']])) {
#       # Use the observation ID in your app, e.g., store it in a reactive value
#       observation_id <- query[['observation_id']]
#       # Do something with the observation_id, such as displaying it or processing it
#     }
#   })
#   
#   # Your server logic here
# }
# 
# shinyApp(ui = ui, server = server)