print("launch")
library(shiny)
library(dplyr)
library(ggplot2)
library(shinyjs)
library(shinyWidgets)
library(leaflet)
library(data.table)
library(htmlwidgets)
library(stringr)
library(DT)
library(rlang)
library(shinyBS)
library(RLumShiny)
library(pracma)
library(solrad)
library(Hmisc)

pos_part <- function(x) {
  return(sapply(x, max, 0))
}

eq = function(x,lat=49) {
  ( (2*(24/(2*pi)) * acos(-tan((lat*pi/180))*tan((pi*Declination(x)/180)))) - (0.1*lat+5) )
}

btwmod <- function(doy, min, max, mod){
  if (min<0 | max>365){
    btw <- (doy >= (min %% mod) | doy <= (max %% mod))
  } else {
    btw <- (doy>=min & doy<=max)
  }
  return(btw)
}

singlesi <- function(doy, lat){  
  trapz(seq(1,doy),(pos_part(eq(seq(1,doy),lat)))) /
    trapz(seq(1,365),(pos_part(eq(seq(1,365),lat))))
}

# Translation dictionary
translations <- list(
  en = list(
    title = "When does a species emerge?",
    search_label = "Search by genus, species, or gallformers code (comma-separated for multiple)",
    gen_label = "Filter by generation:",
    key_button = "Key",
    phenophases_title = "Phenophases",
    phenophase_label = "Filter by phenophase (affects plot but not lines/date ranges):",
    mode_label = "Selection mode:",
    explain_si_button = "Explain Season Index",
    si_title = "Season Index",
    si_content = "Season Index is the percent of annual daylight hours at a given latitude that have accumulated by a given day. Minimum and maximum Season Index values calculated based on the date, latitude, and threshold you select are plotted and used to filter the observations or species listed below.",
    display_label = "Output mode:",
    lines_label = "Plot predicted start-end dates by latitude?",
    lines_choices = c("Yes" = "Yes", "No" = "No"),
    date_label = "Observation date (ignore year)",
    days_label = "How many days before or after the observation do you want to look?",
    threshold_label = "How far from the observation do you want to look?",
    lat_label = "What latitude are you interested in?",
    latrange_label = "Latitude:",
    longrange_label = "Longitude:",
    download_button = "Download as CSV",
    no_data_msg = "There are no observations matching this query.",
    no_species_msg = "There are no matching species.",
    table_columns = c(
      obs_id = "Observation ID",
      binom = "Species",
      phenophase = "Phenophase",
      lifestage = "Life Stage",
      viability = "Viability",
      host = "Host",
      doy = "Day of Year",
      date = "Date",
      latitude = "Latitude",
      longitude = "Longitude",
      sourceURL = "Source URL",
      pageURL = "Page URL"
    ),
    sexgen_emerge = "adults of the sexual generation are expected to emerge",
    sexgen_collect = "galls of the sexual generation can likely be successfully collected for rearing",
    agamic_emerge = "adults of the agamic generation are expected to emerge",
    agamic_collect = "galls of the agamic generation can likely be successfully collected for rearing",
    adults_emerge = "adults are expected to emerge",
    galls_collect = "galls can likely be successfully collected for rearing",
    phenophase_names = list(
      oviscar = "Oviposition Scar",
      developing = "Developing",
      dormant = "Dormant",
      maturing = "Maturing",
      Adult = "Adult",
      perimature = "Recently Emerged"
    ),
    # Graph labels and legends
    graph_labels = list(
      latitude = "Latitude",
      date = "Date",
      line_types = list(
        rearing = "Rearing",
        emergence = "Emergence",
        prediction = "Prediction Latitude",
        selection = "Selection bounds"
      ),
      generations = list(
        sexual = "Sexual Generation",
        agamic = "Agamic Generation",
        blank = "Unknown Generation"
      )
    ),
    # Mode selections
    mode_choices = list(
      click_drag = "Click and drag",
      date_range = "Date range",
      season_index = "Season index"
    ),
    # Display modes
    display_choices = list(
      calc_dates = "Calculate dates",
      view_points = "View data points",
      list_species = "List species"
    ),
    months = c("Jan", "Feb", "Mar", "Apr", "May", "Jun", 
               "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"),
    species_count_msg = "There are %d matching species."
  ),
  es = list(
    title = "¿Cuándo emerge una especie?",
    species_count_msg = "Hay %d especies coincidentes.",
    search_label = "Buscar por género, especie o código gallformers (separados por comas para múltiples)",
    gen_label = "Filtrar por generación:",
    gen_choices = c("sexgen" = "sexual", "agamic" = "agámica", "all" = "todas"),
    key_button = "Leyenda",
    phenophases_title = "Fenofases",
    phenophase_label = "Filtrar por fenofase (afecta el gráfico pero no las líneas/rangos de fechas):",
    mode_label = "Modo de selección:",
    explain_si_button = "Explicar Índice Estacional",
    si_title = "Índice Estacional",
    si_content = "El Índice Estacional es el porcentaje de horas de luz diurna anuales en una latitud determinada que se han acumulado hasta un día específico. Los valores mínimos y máximos del Índice Estacional calculados según la fecha, latitud y umbral que seleccione se grafican y se utilizan para filtrar las observaciones o especies listadas a continuación.",
    display_label = "Modo de visualización:",
    lines_label = "¿Graficar fechas predichas de inicio-fin por latitud?",
    lines_choices = c("Yes" = "Sí", "No" = "No"),
    date_label = "Fecha de observación (ignorar año)",
    days_label = "¿Cuántos días antes o después de la observación desea buscar?",
    threshold_label = "¿Qué tan lejos de la observación desea buscar?",
    lat_label = "¿Qué latitud le interesa?",
    latrange_label = "Latitud:",
    longrange_label = "Longitud:",
    download_button = "Descargar como CSV",
    no_data_msg = "No hay observaciones que coincidan con esta búsqueda.",
    no_species_msg = "No hay especies coincidentes.",
    table_columns = c(
      obs_id = "ID de Observación",
      binom = "Especie",
      phenophase = "Fenofase",
      lifestage = "Etapa de Vida",
      viability = "Viabilidad",
      host = "Huésped",
      doy = "Día del Año",
      date = "Fecha",
      latitude = "Latitud",
      longitude = "Longitud",
      sourceURL = "URL Fuente",
      pageURL = "URL Página"
    ),
    sexgen_emerge = "se espera que emerjan los adultos de la generación sexual",
    sexgen_collect = "es probable que las agallas de la generación sexual se puedan recolectar exitosamente para la cría",
    agamic_emerge = "se espera que emerjan los adultos de la generación agámica",
    agamic_collect = "es probable que las agallas de la generación agámica se puedan recolectar exitosamente para la cría",
    adults_emerge = "se espera que emerjan los adultos",
    galls_collect = "es probable que las agallas se puedan recolectar exitosamente para la cría",
    months = c("Ene", "Feb", "Mar", "Abr", "May", "Jun", 
               "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"),
    phenophase_names = list(
      oviscar = "Cicatriz de Oviposición",
      developing = "En Desarrollo",
      dormant = "Dormante",
      maturing = "Madurando",
      Adult = "Adulto",
      perimature = "Recién Emergido"
    ),
    # Graph labels and legends in Spanish
    graph_labels = list(
      latitude = "Latitud",
      date = "Fecha",
      line_types = list(
        rearing = "Cría",
        emergence = "Emergencia",
        prediction = "Latitud de Predicción",
        selection = "Límites de Selección"
      ),
      generations = list(
        sexual = "Generación Sexual", 
        agamic = "Generación Agámica",
        blank = "Generación Desconocida"
      )
    ),
    # Mode selections in Spanish
    mode_choices = list(
      click_drag = "Clic y arrastrar",
      date_range = "Rango de fechas",
      season_index = "Índice estacional"
    ),
    # Display modes in Spanish
    display_choices = list(
      calc_dates = "Calcular fechas",
      view_points = "Ver puntos de datos",
      list_species = "Listar especies"
    )
  )
)

phenophase_translations <- list(
  oviscar = "Cicatrices indican que se han puesto huevos, pero no hay agalla evidente. Se refiere a la generación del huevo, no a la madre.",
  developing = "La agalla está creciendo activamente; el inductor necesita contacto continuo con la planta.",
  dormant = "El desarrollo de la agalla está completo; el inductor puede madurar si la agalla se retira de la planta.",
  maturing = "Se observó al inductor emergiendo de la agalla en este día.",
  Adult = "Se observó un inductor de vida libre separado de su agalla.",
  perimature = "Se infirió que el inductor emergió de la agalla poco antes de este día."
)

dateText <- function (df, lat, string, current_lang){
  if (!(df$highslope==0|df$lowslope==0)){
    start <- format(as.Date(((lat - df$lowyint[1])/df$lowslope[1]),origin="2023-01-01"), "%B %d")
    end <- format(as.Date(((lat - df$highyint[1])/df$highslope[1]),origin="2023-01-01"), "%B %d")
    if (current_lang == "es") {
      if (sign(df$highslope)==sign(df$lowslope)){
        return(paste0("A ", lat, " grados Norte, ", string, " entre el ", start, " y el ", end, "."))
      } else {
        return(paste0("A ", lat, " grados Norte, ", string, " entre el ", end, " y el ", start, "."))
      }
    } else {
      if (sign(df$highslope)==sign(df$lowslope)){
        return(paste0("At ", lat, " degrees North, ", string, " between ", start, " and ", end, "."))
      } else {
        return(paste0("At ", lat, " degrees North, ", string, " between ", end, " and ", start, "."))
      }
    }
  } else {
    if (current_lang == "es") {
      return(paste0("No hay información disponible para determinar cuando ", string, "."))
    } else {
      return(paste0("No information is available to determine when ", string, "."))
    }
  }
}

shapes <- c(8,1,0,17,18,2)
names(shapes) <- c('oviscar','developing','dormant','maturing','Adult','perimature')

ui <- fluidPage(
  useShinyjs(),
  selectInput("lang", "Language / Idioma",
              choices = c("English" = "en", "Español" = "es"),
              selected = "en"),
  # App title ----
  titlePanel(h1(textOutput("title"))),
  sidebarLayout(
    sidebarPanel(
      textInput("species", 
                label="Search by genus, species, or gallformers code (comma-separated for multiple)", 
                value = "Dryocosmus quercuspalustris"),  # Default search string
      radioButtons("gen",
                   label = "Filter by generation:", 
                   choices = c("all" = "all", "sexgen" = "sexgen", "agamic" = "agamic"),
                   selected = "all"),
      tags$button(
        id = "keyButton",
        "Key",  
        `data-toggle` = "popover",
        `data-placement` = "bottom",
        `data-html` = "true",
        title = "Phenophases", 
        `data-content` = ""
      ),
      tags$style(
        '
    .popover {
      max-width: 300px;
    }
    .popover-content {
      font-size: 16px;
      font-weight: normal;
      color: black;
    }
    '
      ),
      tags$script(
        '
    $(function () {
      $(\'[data-toggle="popover"]\').popover()
    })
    '
      ),
      multiInput("phen",
                 label = textOutput("phenophase_label"),
                 choices = c("oviscar", "developing", "dormant", "maturing", "Adult", "perimature"),
                 selected = c("maturing", "Adult", "perimature")),
      radioButtons("mode", 
                   label = textOutput("mode_label"),
                   choices = c("click_drag" = "click_drag", 
                               "date_range" = "date_range", 
                               "season_index" = "season_index"), 
                   selected = "click_drag"),
      tags$button(
        id = "explainSIButton", 
        "Explain Season Index",  
        `data-toggle` = "popover",
        `data-placement` = "bottom",
        `data-html` = "true",
        title = "Season Index", 
        `data-content` = "" 
      ),
      tags$style(
        '
.popover {
  max-width: 300px;
}
.popover-content {
  font-size: 16px;
  font-weight: normal;
  color: black;
}
'
      ),
      tags$script(
        '
$(function () {
  $(\'[data-toggle="popover"]\').popover()
})
'
      ),
      radioButtons("display", 
                   label = textOutput("display_label"),
                   choices = c("calc_dates" = "calc_dates",
                               "view_points" = "view_points",
                               "list_species" = "list_species"),
                   selected = "view_points"),
      radioButtons("lines", label="Plot predicted start-end dates by latitude?", choices = c("Yes","No")),
      
      dateInput("date", label="Observation date (ignore year)", value =Sys.Date()),
      sliderInput("days", label="How many days before or after the observation do you want to look?", min = 1, max = 183, value = 10),
      sliderInput("thr", label="How far from the observation do you want to look?", min = 0.005, max = 0.5, value = 0.05),
      sliderInput("lat", label="What latitude are you interested in?", min = 8, max=65, value = 40),
      sliderInput("latrange", label="Latitude:", min = 10, max = 65, value = c(10, 65)),
      sliderInput("longrange", label="Longitude:", min = -140, max = -55, value = c(-140, -55)),
      leafletOutput("map", height = "500px")
    ),
    mainPanel(
      plotOutput(outputId = "plot",
                 brush = brushOpts(
                   id = "plot1_brush")),
      textOutput("no_data"),
      textOutput("species_count"),
      dataTableOutput("species_table"),
      textOutput("sexrearRange"),
      textOutput("sexemRange"),
      textOutput("agrearRange"),
      textOutput("agemRange"),
      textOutput("rearRange"),
      textOutput("emRange"),
      dataTableOutput("data_table"),
      uiOutput("downloadButtonUI")
    )
  )
)

server <- function(input, output, session) {
  
  shade_polygon <- function(slope, intercept,
                            xlim = c(0, 366),  # numeric day range
                            ylim = c(20, 55),  # default lat range; we'll override after we know actual plot range
                            direction = c("left","right")) {
    direction <- match.arg(direction)
    
    # Build a grid of y values
    y_seq <- seq(ylim[1], ylim[2], length.out = 300)
    
    # Solve for x on the diagonal line
    x_line <- (y_seq - intercept) / slope
    
    # Clamp x_line to [xlim[1], xlim[2]] if needed
    x_line <- pmin(pmax(x_line, xlim[1]), xlim[2])
    
    if (direction == "right") {
      # Build polygon from line to the right boundary
      poly <- data.frame(
        x = c(x_line, rev(rep(xlim[2], length(y_seq)))),
        y = c(y_seq, rev(y_seq))
      )
    } else {
      # direction == "left"
      poly <- data.frame(
        x = c(rep(xlim[1], length(y_seq)), rev(x_line)),
        y = c(y_seq, rev(y_seq))
      )
    }
    
    # Convert numeric x back to Date
    poly$x_date <- as.Date("1970-01-01") + poly$x
    return(poly)
  }
  
  lang <- reactiveVal("en")
  
  output$downloadButtonUI <- renderUI({
    downloadButton("downloadData", 
                   if(input$lang == "es") "Descargar como CSV" else "Download as CSV")
  })
  
  output$phenophase_label <- renderText({
    translations[[input$lang]]$phenophase_label
  })
  
  output$mode_label <- renderText({
    translations[[input$lang]]$mode_label
  })
  
  output$display_label <- renderText({
    translations[[input$lang]]$display_label
  })
  
  output$title <- renderText({
    translations[[input$lang]]$title
  })
  
  observeEvent(input$lang, {
    lang(input$lang)
    updateTextInput(session, "species", 
                    label = translations[[input$lang]]$search_label)
    
    # Update the multiInput labels
    updateMultiInput(session, "phen",
                     label = translations[[input$lang]]$phenophase_label,
                     choices = setNames(
                       c("oviscar", "developing", "dormant", "maturing", "Adult", "perimature"),
                       c(translations[[input$lang]]$phenophase_names$oviscar,
                         translations[[input$lang]]$phenophase_names$developing,
                         translations[[input$lang]]$phenophase_names$dormant,
                         translations[[input$lang]]$phenophase_names$maturing,
                         translations[[input$lang]]$phenophase_names$Adult,
                         translations[[input$lang]]$phenophase_names$perimature)
                     ),
                     selected = input$phen)
    
    updateRadioButtons(session, "gen",
                       label = translations[[input$lang]]$gen_label,
                       choiceNames = if(input$lang == "es") 
                         c("Sexual", "Agámica", "Todas") 
                       else 
                         c("Sexual Generation", "Agamic Generation", "All"),
                       choiceValues = c("sexgen", "agamic", "all"),
                       selected = input$gen)
    
    updateRadioButtons(session, "mode",
                       label = translations[[input$lang]]$mode_label,
                       choiceNames = unname(unlist(translations[[input$lang]]$mode_choices)),
                       choiceValues = c("click_drag", "date_range", "season_index"),
                       selected = input$mode)
    
    updateRadioButtons(session, "display",
                       label = translations[[input$lang]]$display_label,
                       choiceNames = unname(unlist(translations[[input$lang]]$display_choices)),
                       choiceValues = c("calc_dates", "view_points", "list_species"),
                       selected = input$display)
    
    updateRadioButtons(session, "lines",
                       label = translations[[input$lang]]$lines_label,
                       choiceNames = if(input$lang == "es") c("Sí", "No") else c("Yes", "No"),
                       choiceValues = c("Yes", "No"))
    
    updateSliderInput(session, "days",
                      label = translations[[input$lang]]$days_label)
    
    updateSliderInput(session, "thr",
                      label = translations[[input$lang]]$threshold_label)
    
    updateSliderInput(session, "lat",
                      label = translations[[input$lang]]$lat_label)
    
    updateSliderInput(session, "latrange",
                      label = translations[[input$lang]]$latrange_label)
    
    updateSliderInput(session, "longrange",
                      label = translations[[input$lang]]$longrange_label)
    
    updateDateInput(session, "date",
                    label = translations[[input$lang]]$date_label)
  })
  
  # Modify your existing output renderers to use translations
  output$no_data <- renderText({
    if (nrow(plotted())==0) {
      translations[[lang()]]$no_data_msg
    } else {
      ""
    }
  })
  
  observe({
    js_code <- sprintf('
    $("#keyButton").text("%s");
    $("#keyButton").attr("title", "%s");
    $("#keyButton").attr("data-content", "%s");
    $("#explainSIButton").text("%s");
    $("#explainSIButton").attr("title", "%s");
    $("#explainSIButton").attr("data-content", "%s");
    $("[data-toggle=\'popover\']").popover("dispose").popover();
  ',
                       translations[[input$lang]]$key_button,
                       translations[[input$lang]]$phenophases_title,
                       if(input$lang == "es") {
                         sprintf('<b>Oviscar:</b> %s<br><br><b>Developing:</b> %s<br><br><b>Dormant:</b> %s<br><br><b>Maturing:</b> %s<br><br><b>Adult:</b> %s<br><br><b>Perimature:</b> %s',
                                 phenophase_translations$oviscar,
                                 phenophase_translations$developing,
                                 phenophase_translations$dormant,
                                 phenophase_translations$maturing,
                                 phenophase_translations$Adult,
                                 phenophase_translations$perimature)
                       } else {
                         '<b>Oviscar:</b> Scars indicate eggs have been laid, but no gall is evident. Refers to generation of egg, not mother.<br><br><b>Developing:</b> Gall is actively growing; inducer needs continued contact with the plant.<br><br><b>Dormant:</b> Gall development is complete; inducer can mature if gall is removed from the plant.<br><br><b>Maturing:</b> Inducer was observed emerging from the gall on this day.<br><br><b>Adult:</b> A free-living inducer was observed apart from its gall.<br><br><b>Perimature:</b> Inducer was inferred to have emerged from the gall shortly before this day.'
                       },
                       translations[[input$lang]]$explain_si_button,
                       translations[[input$lang]]$si_title,
                       translations[[input$lang]]$si_content
    )
    shinyjs::runjs(js_code)
  })
  
  output$species_count <- renderText({
    if (nrow(species_list()) == 0) {
      translations[[lang()]]$no_species_msg
    } else {
      gsub("{n}", nrow(species_list()), translations[[lang()]]$species_count_msg)
    }
  })
  
  observe({
    print("Testing shinyjs...")
    print(paste("shinyjs loaded:", require(shinyjs)))
  })
  
  # Function to determine if the app is running locally or on shinyapps.io
  is_local <- function() {
    Sys.getenv('SHINY_PORT') == ""
  }
  
  # Load data based on environment
  load_data <- function() {
    if (is_local()) {
      app_dir <- normalizePath("C:/Users/adam/Documents/GitHub/Phenology/doyCalc/")
      observations_path <- file.path(app_dir, "observations.csv")
      eas_path <- file.path(app_dir, "phenogrid.csv")
      observations <- read.csv(observations_path)
      eas <- read.csv(eas_path)
    } else {
      observations <- read.csv("observations.csv")
      eas <- read.csv("phenogrid.csv")
    }
    list(observations = observations, eas = eas)
  }
  
  data <- load_data()
  observations <- data$observations
  eas <- data$eas
  
  species_limits <- observations %>%
    select(binom, latitude, longitude) %>%
    group_by(binom) %>%
    summarise(min_lat = min(latitude),
              max_lat = max(latitude),
              min_long = min(longitude),
              max_long = max(longitude))
  
  y <- reactive({
    eas %>% select(-longitude) %>% distinct()
  })
  
  # Initialize inputs based on URL parameters
  observe({
    query <- parseQueryString(session$clientData$url_search)
    
    if (!is.null(query[['search']])) {
      search_string <- URLdecode(query[['search']])
      search_terms <- strsplit(search_string, ",")[[1]]
      search_terms <- trimws(search_terms)
      search_string <- paste(search_terms, collapse = ", ")
      updateTextInput(session, "species", value = search_string)
    }
    if (!is.null(query[['gen']])) {
      updateRadioButtons(session, "gen", selected = query[['gen']])
    }
  }, priority = 1000)
  
  output$map <- renderLeaflet({
    leaflet() %>% addTiles() %>%
      setView(lng = -101, lat = 47, zoom = 3)
  })
  
  observe({
    lat1 <- input$latrange[1]
    lat2 <- input$latrange[2]
    lng1 <- input$longrange[1]
    lng2 <- input$longrange[2]
    leafletProxy("map", data = "rect") %>%
      clearShapes() %>%
      addRectangles(lng1 = lng1, lat1 = lat1, lng2 = lng2, lat2 = lat2,
                    layerId = "rect", color = "red", fillOpacity = 0.3)
  })
  
  observeEvent(input$display, {
    if(input$display == "calc_dates"){
      hide("species_count")
      show("sexrearRange")
      show("sexemRange")
      show("agrearRange")
      show("agemRange")
      show("rearRange")
      show("emRange")
      hide("data_table")
      hide("species_table")
      hide("downloadData")
    }
    if(input$display == "view_points"){
      hide("species_count")
      hide("sexrearRange")
      hide("sexemRange")
      hide("agrearRange")
      hide("agemRange")
      hide("rearRange")
      hide("emRange")
      show("data_table")
      hide("species_table")
      show("downloadData")    
    }
    if(input$display == "list_species") {
      show("species_count")
      hide("sexrearRange")
      hide("sexemRange")
      hide("agrearRange")
      hide("agemRange")
      hide("rearRange")
      hide("emRange")
      hide("data_table")
      show("species_table")
      show("downloadData")  
    }
  })
  
  observeEvent(input$mode, {
    if (input$mode == "click_drag") {
      hide("thr")
      hide("days")
      hide("date")
    } else if (input$mode == "date_range") {
      hide("thr")
      show("days")
      show("date")
    } else if (input$mode == "season_index") {
      show("thr")
      hide("days")
      show("date")
    } 
  }, ignoreNULL = FALSE)
  
  match <- reactive({
    search_terms <- unlist(strsplit(input$species, ",\\s*"))
    
    if(input$gen %in% c("sexgen", "agamic")) {
      filtered_observations <- observations %>%
        filter(grepl(paste(sapply(search_terms, escapeRegex), collapse="|"), 
                     binom, ignore.case = TRUE) & generation == input$gen)
    } else {
      filtered_observations <- observations %>%
        filter(grepl(paste(sapply(search_terms, escapeRegex), collapse="|"), 
                     binom, ignore.case = TRUE))
    }
    
    filtered_species_limits <- species_limits %>%
      filter(
        !(max_lat < min(input$latrange) | min_lat > max(input$latrange)) &
          !(max_long < min(input$longrange) | min_long > max(input$longrange))
      )
    
    filtered_observations %>%
      semi_join(filtered_species_limits, by = "binom")
  })
  
  plotted <- reactive({
    if (!is.null(match())){
      plotted <- filter(match(), phenophase %in% input$phen)
      plotted$dateUse <- as.Date(as.numeric(plotted$doy), origin = "1970-01-01")
      return(plotted)
    }
  })
  
  output$no_data <- renderText({
    if (nrow(plotted())==0) {
      translations[[lang()]]$no_data_msg
    } else {
      ""
    }
  })
  
  lineCalc <- reactive({
    function(side, var, thr){
      tf <- y()[which(between(y()[[var]], (side-thr), (side+thr))),]
      tf <- unique(tf)
      tf <- tf %>% group_by(latitude)
      if (length(tf$doy) > 0) {
        tf <- tf %>% filter(doy == min(doy))
      } else {
        tf <- NULL
      }  
      if (isTRUE(dim(tf)[1]>2)){
        mod <- lm(tf$latitude ~ tf$doy)
        param <- coefficients(mod)
      } else {
        param <- c(-9999,0)
      }
      return(param)
    }
  })
  
  doyLatCalc <- reactive({
    function (df){
      if (dim(df)[1]>0){
        if ((max(df$seasind)-min(df$seasind)<0.07) && min(df$seasind)<0.94){
          if (max(df$doy)>171){
            left <- 0.85*mean(df$seasind)
            right <- ifelse(1.15 * mean(df$seasind)> 1, 1, 1.15 * mean(df$seasind))
            var <- "seasind"
            thr <- 0.02
          } else {
            var <- "acchours"
            if (mean(df$acchours)>0){
              left <- 0.8*mean(df$acchours)
              right <- 1.2*mean(df$acchours)
            } else {
              left <- 0
              right <- 1000
            }
            thr <- ((left+right)/2)*0.12
          }
        } else {
          doy <- sort(df$doy)
          diffs <- diff(doy)
          max_diff <- max(diffs)
          if (max_diff>85|min(df$doy)>171){
            split_index <- which(diffs == max_diff)
            spring <- df[df$doy <= doy[split_index], ]
            fall <- df[df$doy > doy[split_index], ]
            var <- "seasind"
            thr <- 0.02
            left <- mean(unique(spring[spring$doy==max(spring$doy),"seasind"]))
            right <- mean(unique(fall[fall$doy==min(fall$doy),"seasind"]))
          } else {
            var <- "acchours"
            left <-  min(df$acchours)
            right <- max(df$acchours)
            thr <- ((left+right)/2)*0.12
          }
        }
        
        low <- lineCalc()(left, var, thr)
        high <- lineCalc()(right, var, thr)
      } else {
        low <- c(-9999,0)
        high <- c(-9999,0)
      }
      
      coef <- rbind(low,high)
      lowslope <- coef[1,2]
      lowyint <- coef[1,1]
      highslope <- coef[2,2]
      highyint <- coef[2,1]
      
      if ((lowslope<0&&highslope<0)&&abs(lowslope-highslope)<0.05) {
        highslope <- 10^10
        highyint <- -10^10*365 
      }
      
      param <- as.data.frame(t(c(lowslope,lowyint,highslope,highyint)))
      colnames(param) <- c("lowslope","lowyint","highslope","highyint")
      return(param)
    }
  })
  
  #-----------------------------------------------------------------
  # Helper to shade horizontally to left or right of a line
  # slope, intercept are from lineCalc() => line: y = slope*x + intercept
  # We invert that to x = (y - intercept)/slope
  # Then build a polygon that runs from that line out to xlim[1] or xlim[2].

  #-----------------------------------------------------------------
  
  P <- reactive({
    req(nrow(plotted())>0)
    select <- match()
    
    sexrear <- filter(select, viability == "viable" & generation == "sexgen")
    sexem <- filter(select, phenophase %in% c("maturing", "perimature", "Adult") & generation == "sexgen")
    agrear <- filter(select, viability == "viable" & generation == "agamic")
    agem <- filter(select, phenophase %in% c("maturing", "perimature", "Adult") & generation == "agamic")
    rear <- filter(select, viability == "viable" & (is.na(generation) | generation == "NA"))
    em <- filter(select, phenophase %in% c("maturing", "perimature", "Adult") & (is.na(generation)|generation == "NA"))
    
    sexrearparam <- doyLatCalc()(sexrear)
    sexemparam <- doyLatCalc()(sexem)
    agrearparam <- doyLatCalc()(agrear)
    agemparam <- doyLatCalc()(agem)
    rearparam <- doyLatCalc()(rear)
    emparam <- doyLatCalc()(em)
    
    plotted <- plotted()
    
    plotted$color <- ifelse(is.na(plotted$generation) | plotted$generation == "", "blank",
                            plotted$generation)
    
    plotted$lifestage[plotted$lifestage == ""] <- NA
    for (i in 1:dim(plotted)[1]){
      plotted$alpha[i] <- ifelse(isTRUE(!is.na(plotted$lifestage[i]) | plotted$viability[i] == "viable"), 1, 0.2)
    }
    
    if (min(plotted$latitude) < 20) {
      ymin <- min(plotted$latitude)-2
    } else {
      ymin <- 20
    }
    
    if (max(plotted$latitude) > 55) {
      ymax <- max(plotted$latitude)+2
    } else {
      ymax <- 55
    }
    
    p <- ggplot(data = plotted, aes(x = dateUse, y = latitude, color = color, shape = phenophase)) +
      geom_point(aes(alpha = alpha), size = 3) +
      scale_linetype_manual(
        name = "Line Type",
        values = c("Rearing" = "dotted",
                   "Emergence" = "solid",
                   "Prediction Latitude" = "dashed",
                   "Selection bounds" = "twodash"),
        labels = with(translations[[input$lang]]$graph_labels$line_types,
                      c(rearing, emergence, prediction, selection))
      ) +
      ylim(ymin, ymax) +
      scale_x_date(
        breaks = c(
          as.Date(paste0("1970-", seq(1, 10, by = 3), "-15")),
          as.Date("1971-01-15")
        ),
        labels = c(
          translations[[input$lang]]$months[seq(1, 10, by = 3)],
          translations[[input$lang]]$months[1]
        ),
        limits = as.Date(c("1970-01-01", "1971-01-02"))
      ) +
      scale_color_manual(
        values = c("blank" = "black", "sexgen" = "blue", "agamic" = "red", "Selection bounds" = "green"),
        labels = if (input$lang == "es") {
          c("blank" = "Generación Desconocida", 
            "sexgen" = "Generación Sexual", 
            "agamic" = "Generación Agámica")
        } else {
          c("blank" = "Unknown Generation", 
            "sexgen" = "Sexual Generation", 
            "agamic" = "Agamic Generation")
        },
        name = if (input$lang == "es") "Generación" else "Generation"
      ) +
      scale_shape_manual(
        values = shapes,
        labels = sapply(names(shapes), function(name) translations[[input$lang]]$phenophase_names[[name]])
      ) +
      scale_alpha(guide = "none") +
      theme(
        axis.text = element_text(size = rel(1.5)),
        axis.title = element_text(size = rel(1.5)),
        legend.text = element_text(size = rel(1.5)),
        legend.title = element_text(size = rel(1.5))
      ) +
      guides(shape = guide_legend(override.aes = list(size = 5))) +
      guides(color = guide_legend(override.aes = list(size = 7))) +
      guides(linetype = guide_legend(override.aes = list(lwd = 0.75))) +
      labs(
        x = translations[[input$lang]]$graph_labels$date,
        y = translations[[input$lang]]$graph_labels$latitude,
        title = ""
      )
    
    if (input$lines == "Yes") {
      p <- p + geom_abline(aes(intercept = sexrearparam$lowyint[1], slope=sexrearparam$lowslope[1], linetype="Rearing"), color="blue")+
        geom_abline(aes(intercept = sexrearparam$highyint[1], slope=sexrearparam$highslope[1], linetype="Rearing"), color="blue")+
        geom_abline(aes(intercept = sexemparam$lowyint[1], slope=sexemparam$lowslope[1], linetype="Emergence"), color="blue")+
        geom_abline(aes(intercept = sexemparam$highyint[1], slope=sexemparam$highslope[1], linetype="Emergence"), color="blue")+
        geom_abline(aes(intercept = agrearparam$lowyint[1], slope=agrearparam$lowslope[1], linetype="Rearing"), color="red")+
        geom_abline(aes(intercept = agrearparam$highyint[1], slope=agrearparam$highslope[1], linetype="Rearing"), color="red")+
        geom_abline(aes(intercept = agemparam$lowyint[1], slope=agemparam$lowslope[1], linetype="Emergence"), color="red")+
        geom_abline(aes(intercept = agemparam$highyint[1], slope=agemparam$highslope[1], linetype="Emergence"), color="red")+
        geom_abline(aes(intercept = rearparam$lowyint[1], slope=rearparam$lowslope[1], linetype="Rearing"), color="black")+
        geom_abline(aes(intercept = rearparam$highyint[1], slope=rearparam$highslope[1], linetype="Rearing"), color="black")+
        geom_abline(aes(intercept = emparam$lowyint[1], slope=emparam$lowslope[1], linetype="Emergence"), color="black")+
        geom_abline(aes(intercept = emparam$highyint[1], slope=emparam$highslope[1], linetype="Emergence"), color="black")
    } 
    
    if (input$display == "calc_dates") {
      p <- p + geom_hline(aes(yintercept = input$lat), linetype = "dashed")
    } 
    
    # DATE_RANGE shading
    if (input$mode == "date_range") {
      doy <- as.integer(format(as.Date(input$date),"%j"))
      low_doy <- (doy - input$days) %% 365
      high_doy <- (doy + input$days) %% 365
      low <- as.Date(low_doy, origin = "1970-01-01")
      high <- as.Date(high_doy, origin = "1970-01-01")
      
      if (low_doy > high_doy) {
        rect1 <- data.frame(
          xmin = as.Date("1970-01-01"),
          xmax = high,
          ymin = ymin,
          ymax = ymax
        )
        rect2 <- data.frame(
          xmin = low,
          xmax = as.Date("1971-01-01"),
          ymin = ymin,
          ymax = ymax
        )
        
        p <- p +
          geom_vline(xintercept = low, linetype = "twodash", color="green") + 
          geom_vline(xintercept = high, linetype = "twodash", color="green") +
          geom_rect(data = rect1, 
                    aes(xmin = xmin, xmax = xmax, ymin = ymin, ymax = ymax), 
                    fill = "green", alpha = 0.1, inherit.aes = FALSE) +
          geom_rect(data = rect2, 
                    aes(xmin = xmin, xmax = xmax, ymin = ymin, ymax = ymax), 
                    fill = "green", alpha = 0.1, inherit.aes = FALSE)
      } else {
        rect <- data.frame(
          xmin = low,
          xmax = high,
          ymin = ymin,
          ymax = ymax
        )
        
        p <- p +
          geom_vline(xintercept = low, linetype = "twodash", color="green") + 
          geom_vline(xintercept = high, linetype = "twodash", color="green") +
          geom_rect(data = rect, 
                    aes(xmin = xmin, xmax = xmax, ymin = ymin, ymax = ymax), 
                    fill = "green", alpha = 0.1, inherit.aes = FALSE)
      }
    }
    
    # SEASON_INDEX shading
    if (input$mode == "season_index") {
      doy <- as.integer(format(as.Date(input$date),"%j"))
      si <- singlesi(doy, input$lat)
      min <- (si - input$thr) %% 1
      max <- (si + input$thr) %% 1
      low <- lineCalc()(min, "seasind", 0.02)
      high <- lineCalc()(max, "seasind", 0.02)
      
      p <- p + 
        geom_abline(aes(intercept = low[1], slope=low[2], linetype="Selection bounds"), color="green") +
        geom_abline(aes(intercept = high[1], slope=high[2], linetype="Selection bounds"), color="green")
      
      x_vals <- seq(as.Date("1970-01-01"), as.Date("1971-01-01"), by="day")
      days <- as.numeric(x_vals - as.Date("1970-01-01"))
      
      low_y <- pmax(pmin(low[2]*days + low[1], ymax), ymin)
      high_y <- pmax(pmin(high[2]*days + high[1], ymax), ymin)
      
      opposite_slopes <- (sign(low[2]) != sign(high[2]))
      straddling_winter <- (min > max) && opposite_slopes
      straddling_summer <- (min < max) && opposite_slopes
      
      if (!opposite_slopes) {
        # Spring/Fall - shade between lines (vertical)
        p <- p + 
          geom_ribbon(data = data.frame(x = x_vals, low_y = low_y, high_y = high_y),
                      aes(x = x, ymin = pmin(low_y, high_y), ymax = pmax(low_y, high_y)),
                      fill = "green", alpha = 0.1, inherit.aes = FALSE)
      } else if (straddling_winter) {
        # Winter: slopes are opposite, min>max => negative slope shades right, positive slope shades left
        neg_slope <- if (low[2] < 0) low[2] else high[2]
        neg_int   <- if (low[2] < 0) low[1] else high[1]
        pos_slope <- if (low[2] < 0) high[2] else low[2]
        pos_int   <- if (low[2] < 0) high[1] else low[1]
        
        # Construct polygons that extend horizontally
        neg_poly <- shade_polygon(neg_slope, neg_int, xlim=c(0, max(days)), ylim=c(ymin, ymax), direction="right")
        pos_poly <- shade_polygon(pos_slope, pos_int, xlim=c(0, max(days)), ylim=c(ymin, ymax), direction="left")
        
        p <- p +
          geom_polygon(data = neg_poly,
                       aes(x = x_date, y = y),
                       fill = "green", alpha = 0.1,
                       color = NA,  # no outline
                       inherit.aes = FALSE) +
          geom_polygon(data = pos_poly,
                       aes(x = x_date, y = y),
                       fill = "green", alpha = 0.1,
                       color = NA,
                       inherit.aes = FALSE)
        
      } else if (straddling_summer) {
        # Opposite slopes, min < max => negative slope + positive slope crossing
        neg_slope <- if (low[2] < 0) low[2] else high[2]
        neg_int   <- if (low[2] < 0) low[1] else high[1]
        pos_slope <- if (low[2] < 0) high[2] else low[2]
        pos_int   <- if (low[2] < 0) high[1] else low[1]
        
        # Define a sequence of y-values spanning your lat plot range
        y_seq <- seq(ymin, ymax, length.out = 300)
        
        # Solve x = (y - intercept) / slope for both lines
        x_neg <- (y_seq - neg_int) / neg_slope
        x_pos <- (y_seq - pos_int) / pos_slope
        
        # If at some y you get x_neg > x_pos, swap them so that x_left <= x_right
        x_left  <- pmin(x_neg, x_pos)
        x_right <- pmax(x_neg, x_pos)
        
        # Build a polygon that goes along the left edge from bottom to top
        # and returns along the right edge from top to bottom
        poly_df <- data.frame(
          x = c(x_left, rev(x_right)),
          y = c(y_seq,    rev(y_seq))
        )
        
        # Convert numeric x to dates if you have a date scale
        poly_df$x_date <- as.Date("1970-01-01") + poly_df$x
        
        # Add one polygon that encloses the region between lines
        p <- p +
          geom_polygon(
            data = poly_df,
            aes(x = x_date, y = y),
            fill = "green",  # or whatever
            alpha = 0.1,
            color = NA,
            inherit.aes = FALSE
          )
      }
      
    }
    
    return(p)
  })
  
  output$plot <- renderPlot({
    P()
  })
  
  output$sexemRange <- renderText({
    req(any(match()$generation=="sexgen"))
    select <- match()
    sexem <- filter(select, phenophase %in% c("maturing", "perimature", "Adult") & generation == "sexgen")
    sexemparam <- doyLatCalc()(sexem)
    dateText(sexemparam, input$lat, translations[[input$lang]]$sexgen_emerge, input$lang)
  })
  output$sexrearRange <- renderText({
    req(any(match()$generation=="sexgen"))
    select <- match()
    sexrear <- filter(select, viability == "viable" & generation == "sexgen")
    sexrearparam <- doyLatCalc()(sexrear)
    dateText(sexrearparam, input$lat, translations[[input$lang]]$sexgen_collect, input$lang)
  })
  output$agemRange <- renderText({
    req(any(match()$generation=="agamic"))
    select <- match()
    agem <- filter(select, phenophase %in% c("maturing", "perimature", "Adult") & generation == "agamic")
    agemparam <- doyLatCalc()(agem)
    dateText(agemparam, input$lat, translations[[input$lang]]$agamic_emerge, input$lang)
  })
  output$agrearRange <- renderText({
    req(any(match()$generation=="agamic"))
    select <- match()
    agrear <- filter(select, viability == "viable" & generation == "agamic")
    agrearparam <- doyLatCalc()(agrear)
    return(dateText(agrearparam, input$lat, translations[[input$lang]]$agamic_collect, input$lang))
  })
  output$emRange <- renderText({
    req(any(is.na(match()$generation))|any(match()$generation==""))
    select <- match()
    em <- filter(select, phenophase %in% c("maturing", "perimature", "Adult") & (is.na(generation)|generation == "NA"))
    emparam <- doyLatCalc()(em)
    return(dateText(emparam, input$lat, translations[[input$lang]]$adults_emerge, input$lang))
  })
  output$rearRange <- renderText({
    req(any(is.na(match()$generation))|any(match()$generation==""))
    select <- match()
    rear <- filter(select, viability == "viable" & (is.na(generation) | generation == "NA"))
    rearparam <- doyLatCalc()(rear)
    return(dateText(rearparam, input$lat, translations[[input$lang]]$galls_collect, input$lang))
  })
  
  data <- reactive({
    doy <- as.integer(format(as.Date(input$date),"%j"))
    if (input$mode == "click_drag"){
      brushed_data <- brushedPoints(plotted(), input$plot1_brush)
      return(brushed_data)
    } else if (input$mode == "date_range") {
      min <- (doy - input$days) %% 365
      max <- (doy + input$days) %% 365
      if (min > max) {
        date_data <- subset(plotted(), doy <= max | doy >= min)
      } else {
        date_data <- subset(plotted(), doy >= min & doy <= max)
      }
      return(date_data) 
    } else if (input$mode == "season_index") {
      si <- singlesi(doy, input$lat)
      mod_dist <- function(x, center) {
        d <- abs(x - center)
        pmin(d, 1-d)
      }
      si_data <- subset(plotted(), mod_dist(seasind, si) <= input$thr)
      return(si_data) 
    }
  })
  
  species_list <- reactive({
    req(data())
    data <- data() %>%
      mutate(link = paste0("<a href=", gfURL, ">", binom, "</a>"))
    
    unique_binoms <- data %>%
      select(binom, link) %>%
      distinct() %>%
      arrange(binom)
    
    # If empty, return a data frame with one column named "Species"
    if (nrow(unique_binoms) == 0) {
      empty_df <- data.frame(matrix(ncol = 1, nrow = 0))
      colnames(empty_df) <- "Species"
      return(empty_df)
    }
    
    # If not empty, create a DF that also has one column named "Species"
    species <- data.frame(Species = unique_binoms$link,
                          stringsAsFactors = FALSE)
    return(species)
  })
  
  
  output$species_table <- renderDT({ 
    req(species_list())
    DT::datatable(
      species_list(),
      rownames = FALSE, 
      escape = FALSE,
      colnames = if (input$lang == "es") c("Especies") else c("Species"),
      options = list(
        language = if (input$lang == "es") list(
          search = "Buscar:",
          lengthMenu = "Mostrar _MENU_ registros",
          info = "Mostrando _START_ a _END_ de _TOTAL_ registros",
          infoEmpty = "Mostrando 0 a 0 de 0 registros",
          infoFiltered = "(filtrado de _MAX_ registros totales)",
          paginate = list(
            first = "Primero",
            previous = "Anterior",
            `next` = "Siguiente",
            last = "Último"
          ),
          zeroRecords = "No se encontraron resultados"
        ) else list()
      )
    )
  })
  
  
  output$data_table <- renderDT({  
    req(data())
    data <- data()
    data_reordered <- data[,c("obs_id","binom","phenophase","lifestage","viability", 
                              "host","doy", "date","latitude","longitude", 
                              "sourceURL","pageURL")]
    colnames(data_reordered) <- translations[[input$lang]]$table_columns
    
    DT::datatable(
      data_reordered,
      rownames = FALSE,
      escape = FALSE,
      options = list(
        language = if(input$lang == "es") list(
          search = "Buscar:",
          lengthMenu = "Mostrar _MENU_ registros",
          info = "Mostrando _START_ a _END_ de _TOTAL_ registros",
          infoEmpty = "Mostrando 0 a 0 de 0 registros",
          infoFiltered = "(filtrado de _MAX_ registros totales)",
          paginate = list(
            first = "Primero",
            previous = "Anterior",
            `next` = "Siguiente",
            last = "Último"
          ),
          zeroRecords = "No se encontraron resultados"
        ) else list(),
        columnDefs = list(
          list(targets = 10,
               render = JS("function(data, type, row, meta) {\n if (type === 'display') {\n return '<a href=' + data + ' target=\\'_blank\\'>' + data + '</a>';\n } else {\n return data;\n }\n }")),
          list(targets = 11,
               render = JS("function(data, type, row, meta) {\n if (type === 'display') {\n return '<a href=' + data + ' target=\\'_blank\\'>' + data + '</a>';\n } else {\n return data;\n }\n }"))
        )
      )
    )
  })
  
  output$species_count <- renderText({
    req(species_list())
    count <- nrow(species_list())
    if (count == 0) {
      translations[[lang()]]$no_species_msg
    } else {
      sprintf(translations[[lang()]]$species_count_msg, count)
    }
  })
  
  output$downloadData <- downloadHandler(
    filename = "selectedData.csv",
    content = function(file) {
      if (input$display == "list_species") {
        write.csv(species_list(), file, row.names = FALSE)
      } else if (input$display == "view_points") {
        data <- data()
        data_reordered <- data[,c("obs_id","binom","phenophase","lifestage","viability", 
                                  "host","doy", "date","latitude","longitude", 
                                  "sourceURL","pageURL")]
        write.csv(data_reordered, file, row.names = FALSE)
      } else {
        return(NULL)
      }
    }
  )
}

shinyApp(ui = ui, server = server)
