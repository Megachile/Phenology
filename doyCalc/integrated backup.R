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

eas <- read.csv("phenogrid.csv")
y <- eas %>% select(-longitude)
y <- distinct(y)
observations <- read.csv("observations.csv")

# species_limits <- observations %>%
#   select(binom, latitude, longitude) %>%
#   group_by(binom) %>%
#   summarise(min_lat = min(latitude),
#             max_lat = max(latitude),
#             min_long = min(longitude),
#             max_long = max(longitude))

lineCalc <- function(side, var, thr){
  tf <- y[which(between(y[[var]],(side-thr),(side+thr)  )),]
  tf <- unique(tf)
  tf <- tf %>% group_by(latitude)
  if (length(tf$doy) > 0) {
    tf <- tf %>% filter(doy == min(doy))
  } else {
    tf <- NULL
  }  
  if (is_true(dim(tf)[1]>2)){
    mod <- lm(tf$latitude~tf$doy)
    param <- coefficients(mod)
  } else {
    param <- c(-9999,0)
  }
  return(param)
}

doyLatCalc <- function (df){
  if (dim(df)[1]>0){
    
    if (dim(df)[1]==1){
      if (df$doy[1]>171){
        left <- 0.9*df$seasind[1]
        right <- ifelse(1.1 * df$seasind[1] > 1, 1, 1.1 * df$seasind[1])
        var <- "seasind"
        thr <- 0.02
      } else {
        var <- "acchours"
        left <- 0.9*df$acchours[1]
        right <- 1.1*df$acchours[1]
        thr <- ((left+right)/2)*0.12
      }
    } else {
      doy <- sort(df$doy)
      diffs <- diff(doy)
      max_diff <- max(diffs)
      
      # range <- max(df$doy, na.rm=TRUE) - min(df$doy, na.rm=TRUE)
      
      if (max_diff>85|min(df$doy)>171){
        
        # Find the index of the element that precedes the largest gap
        split_index <- which(diffs == max_diff)
        
        # Divide the dataset into two subsets based on the split index
        spring <- df[df$doy <= doy[split_index], ]
        fall <- df[df$doy > doy[split_index], ]
        
        var <- "seasind"
        thr <- 0.02
        
        left <- mean(unique(spring[spring$doy==max(spring$doy),"seasind"]))
        right <- mean(unique(fall[fall$doy==min(fall$doy),"seasind"]))
        
      }
      else {
        # if (range>35){
        var <- "acchours"
        left <-  min(df$acchours)
        right <-  max(df$acchours)
        
        thr <- ((left+right)/2)*0.12
        # }
        # else {
        #   var <- "seasind"
        #   left <- min(df$seasind)
        #   right <- max(df$seasind)
        #   thr <- 0.02
        # }
      }
    }
    
    low <- lineCalc(left, var, thr)
    high <- lineCalc(right, var, thr)
    
  } else {
    low <- c(-9999,0)
    high <- c(-9999,0)
  }
  
  coef <- rbind(low,high)
  
  lowslope <- coef[1,2]
  lowyint <- coef[1,1]
  highslope <- coef[2,2]
  highyint <- coef[2,1]
  
  param <- as.data.frame(t(c(lowslope,lowyint,highslope,highyint)))
  colnames(param) <- c("lowslope","lowyint","highslope","highyint")
  return(param)
}

dateText <- function (df, lat, string){
  if (!(df$highslope==0|df$lowslope==0)){
    start <- format(as.Date(((lat - df$lowyint[1])/df$lowslope[1]),origin="2023-01-01"), "%B %d")
    end <- format(as.Date(((lat - df$highyint[1])/df$highslope[1]),origin="2023-01-01"), "%B %d")
    if (sign(df$highslope)==sign(df$lowslope)){
      return(paste0("At ", lat, " degrees North, ", string, " between ", start, " and ", end, "."))
    } else {
      return(paste0("At ", lat, " degrees North, ", string, " between ", end, " and ", start, "."))
    }
  } else {
    return(paste0("No information is available to determine when ", string, "."))
  }
}

shapes <- c(8,1,0,17,18,2)
names(shapes) <- c('oviscar','developing','dormant','maturing','Adult','perimature')

ui <- fluidPage(
  useShinyjs(),
  # App title ----
  titlePanel("When does a species emerge?"),
  sidebarLayout(
    sidebarPanel(
      textInput("species",label="Search by genus, species, or gallformers code", value = "Dryocosmus quercuspalustris"),
      radioButtons("gen",label="Filter by generation:", choices = c("sexgen","agamic","all"),selected = "all"),
      tags$button(
        "Key",
        `data-toggle` = "popover",
        `data-placement` = "bottom",
        `data-html` = "true",
        title = "Phenophases",
        `data-content` = '<b>Oviscar:</b> Scars indicate eggs have been laid, but no gall is evident. Refers to generation of egg, not mother.<br><br>
                  <b>Developing:</b> Gall is actively growing; inducer needs continued contact with the plant.<br><br>
                  <b>Dormant:</b> Gall development is complete; inducer can mature if gall is removed from the plant.<br><br>
                  <b>Maturing:</b> Inducer was observed emerging from the gall on this day.<br><br>
                  <b>Adult:</b> A free-living inducer was observed apart from its gall.<br><br>
                  <b>Perimature:</b> Inducer was inferred to have emerged from the gall shortly before this day.'
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
      multiInput("phen",label="Filter by phenophase (affects plot but not lines/date ranges):", choices = c("oviscar","developing","dormant","maturing","Adult","perimature"),selected = c("maturing","Adult","perimature")),
      radioButtons("mode", label="Select output mode:", choices = c("Calculate dates", "View data points", "Select species from plot", "List species"), selected = "List species"),
      checkboxInput("correct",label="Correct for latitude?", value=FALSE),
      div(id = "myPopover",
          popover("Explain", "Selecting this option filters by Season Index rather than day of year. Season Index is the percent of annual daylight hours at a given latitude that have accumulated by a given day. It excludes species emerging at the same date but much further north or south of your site of interest, and allows some extrapolation for species with limited data. However, at wider thresholds it overcorrects by lumping late fall and early spring galls together.")
      ),
      dateInput("date", label="Observation date (ignore year)", value =Sys.Date()),
      sliderInput("days", label="How many days before or after the observation do you want to look?", min = 1, max = 183, value = 10),
      sliderInput("thr", label="How far from the observation do you want to look?", min = 0.005, max = 0.5, value = 0.05),
      sliderInput("lat", label="What latitude are you interested in?", min = 8, max=65, value = 40),
      
      # sliderInput("latrange", label="Latitude:", min = 10, max = 65, value = c(10, 65)),
      # sliderInput("longrange", label="Longitude:", min = -140, max = -55, value = c(-140, -55)),
      # leafletOutput("map", height = "500px"),  
    ),
    mainPanel(
      plotOutput(outputId = "plot",
                 brush = brushOpts(
                   id = "plot1_brush")),
      textOutput("no_data"),
      textOutput("species_count"),
      dataTableOutput("species_table"),
      # verbatimTextOutput("bounds"),
      textOutput("sexrearRange"),
      textOutput("sexemRange"),
      textOutput("agrearRange"),
      textOutput("agemRange"),
      textOutput("rearRange"),
      textOutput("emRange"),
      dataTableOutput("brush_info"),
      dataTableOutput("brush_list"),
      downloadButton("downloadData", "Download as CSV")
    )
  )
)

server <- function(input, output, session) {
  # output$map <- renderLeaflet({
  #   leaflet() %>% addTiles() %>%
  #     setView(lng = -101, lat = 47, zoom = 3)
  # })
  # 
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
    if (input$mode == "Calculate dates") {
      show("sexrearRange")
      show("sexemRange")
      show("agrearRange")
      show("agemRange")
      show("rearRange")
      show("emRange")
      show("lat")
      hide("brush_info")
      hide("brush_list")
      hide("downloadData")
      shinyjs::hide("myPopover")
      hide("thr")
      hide("correct")
      hide("days")
      hide("date")
      hide("species_count")
      hide("species_table")
    } else if (input$mode == "View data points") {
      hide("lat")
      hide("sexrearRange")
      hide("sexemRange")
      hide("agrearRange")
      hide("agemRange")
      hide("rearRange")
      hide("emRange")
      show("brush_info")
      hide("brush_list")
      show("downloadData")
      shinyjs::hide("myPopover")
      hide("thr")
      hide("correct")
      hide("days")
      hide("date")
      hide("species_count")
      hide("species_table")
    } else if (input$mode == "Select species from plot") {
      hide("lat")
      hide("sexrearRange")
      hide("sexemRange")
      hide("agrearRange")
      hide("agemRange")
      hide("rearRange")
      hide("emRange")
      hide("brush_info")
      show("brush_list")
      shinyjs::hide("myPopover")
      show("downloadData")
      hide("thr")
      hide("correct")
      hide("days")
      hide("date")
      hide("species_count")
      hide("species_table")
    } else if (input$mode == "List species") {
      updateTextInput(session, "species", value = "")
      show("correct")
      if (input$correct) {
        show("thr")
        show("lat")
        hide("days")
      } else {
        hide("thr")
        hide("lat")
        show("days")
      }
      shinyjs::show("myPopover")
      hide("sexrearRange")
      hide("sexemRange")
      hide("agrearRange")
      hide("agemRange")
      hide("rearRange")
      hide("emRange")
      hide("brush_info")
      hide("brush_list")
      show("downloadData")
      show("date")
      show("species_count")
      show("species_table")
    }
  })
  
  observeEvent(input$correct, {
    if (input$mode == "List species") {
      if (input$correct) {
        show("thr")
        show("lat")
        hide("days")
      } else {
        hide("thr")
        hide("lat")
        show("days")
      }
    }
  })
  
  match <- reactive({
    if(input$gen %in% c("sexgen", "agamic")) {
      filtered_observations <- observations %>%
        filter(grepl(input$species, binom, ignore.case = TRUE) & generation == input$gen)
    } else {
      filtered_observations <- observations %>%
        filter(grepl(input$species, binom, ignore.case = TRUE))
    }
    
    # filtered_species_limits <- species_limits %>%
    #   filter(min_lat >= min(input$latrange) & max_lat <= max(input$latrange)) %>%
    #   filter(min_long >= min(input$longrange) & max_long <= max(input$longrange))
    # 
    # filtered_observations %>%
    #   inner_join(filtered_species_limits, by = c("binom" = "binom"))
    # 
    
  })
  
  plotted <- reactive({
    if (!is.null(match())){
      plotted <- filter(match(), phenophase %in% input$phen)
      plotted$dateUse <- as.Date(as.numeric(plotted$doy), origin = "1970-01-01")
      return(plotted)
    }
  })
  
  output$no_data <- renderText({
    if (nrow(plotted())==0)
    {"There are no observations matching this query."}
    else {""}
  })
  
  P <- reactive({
    req(nrow(plotted())>0)
    select <- match()
    
    sexrear <- filter(select, viability == "viable" & generation == "sexgen")
    sexem <- filter(select, phenophase %in% c("maturing", "perimature", "Adult") & generation == "sexgen")
    agrear <- filter(select, viability == "viable" & generation == "agamic")
    agem <- filter(select, phenophase %in% c("maturing", "perimature", "Adult") & generation == "agamic")
    rear <- filter(select, viability == "viable" & (is.na(generation) | generation == "NA"))
    em <- filter(select, phenophase %in% c("maturing", "perimature", "Adult") & (is.na(generation)|generation == "NA"))
    
    sexrearparam <- doyLatCalc(sexrear)
    sexemparam <- doyLatCalc(sexem)
    agrearparam <- doyLatCalc(agrear)
    agemparam <- doyLatCalc(agem)
    rearparam <- doyLatCalc(rear)
    emparam <- doyLatCalc(em)
    
    plotted <- plotted()
    
    # Assign colors to different groups of points
    plotted$color <- ifelse(is.na(plotted$generation), "Blank",
                            ifelse(plotted$generation == "agamic", "agamic",
                                   ifelse(plotted$generation == "sexgen", "sexgen", "Blank")))
    
    # Assign alpha to different groups of points
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
    
    p <- ggplot(data = plotted, aes(x = dateUse, y = latitude, color = color, shape=phenophase, size=22)) +
      geom_point(aes(alpha = alpha))+
      scale_linetype_manual(name = "Line Type", values = c("Rearing" = "dotted", "Emergence" = "solid", "Prediction Latitude" = "dashed"))+
      ylim(ymin,ymax)+
      scale_x_date(date_labels = "%b", limits = as.Date(c("1970-01-01", "1971-01-02")))+
      scale_color_manual(values = c("Blank"="black","sexgen" = "blue", "agamic"="red"))+
      scale_shape_manual(values= shapes)+
      scale_size(guide = "none")+
      scale_alpha(guide = "none")+
      theme(
        axis.text = element_text(size = rel(1.5)),
        axis.title = element_text(size = rel(1.5)),
        legend.text = element_text(size = rel(1.5)),
        legend.title = element_text(size = rel(1.5))
      )+
      guides(shape = guide_legend(override.aes = list(size = 5)))+
      labs(x = "", y = "Latitude", title = "")
    
    if (input$mode != "List species") {
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
    if (input$mode == "Calculate dates") {
      p <- p + geom_hline(yintercept = input$lat, linetype = "dashed")
    } 
    else if (input$mode == "List species") {
      doy <- as.integer(format(as.Date(input$date),"%j"))
      
      
      
      if (!input$correct){
        #rectangle
        low <- as.Date(((doy - input$days) %% 365), origin = "1970-01-01")
        high <- as.Date(((doy + input$days) %% 365), origin = "1970-01-01")
        rect <- data.frame(
          xmin = low,
          xmax = high,
          ymin=ymin,
          ymax=ymax)
        
        p <- p + geom_rect(data = rect, aes(xmin = xmin, xmax = xmax, ymin = ymin, ymax = ymax), fill = "gray", alpha = 0.4, inherit.aes = FALSE)
        # + geom_vline(xintercept = low, color="green") + geom_vline(xintercept = high, color="green") +
      }
      else {
        si <- singlesi(doy, input$lat)
        min <- (si-input$thr) %% 1
        max <- (si+input$thr) %% 1
        low <- lineCalc(min, "seasind", 0.02)
        high <- lineCalc(max, "seasind", 0.02)
        p <- p + geom_abline(aes(intercept = low[1], slope=low[2]), color="green")+
          geom_abline(aes(intercept = high[1], slope=high[2]), color="green")
        
        highline  <- function(x) as.integer(format(as.Date(x),"%j"))*high[2]+high[1]
        lowline <- function(x) as.integer(format(as.Date(x),"%j"))*low[2]+low[1]
        
        if (high[2]<0&&low[2]>0){
          #  triangles
          print("triangles in")
          p <- p + geom_ribbon(mapping = aes(ymin = after_stat(lowline(y)), ymax = after_stat(highline(y)) ),
                               fill = 'lightblue', alpha = 0.5, color="transparent", inherit.aes = FALSE)
          
          
        } else if (high[2]>0&&low[2]<0) {
          #triangles backwards
          print("triangles out")
          
          p <- p + geom_polygon(stat = 'function', fun = highline,
                                mapping = aes(ymin = after_stat(y), ymax = Inf),
                                fill = 'lightblue', alpha = 0.5, color="transparent", inherit.aes = FALSE)+
            geom_polygon(stat = 'function', fun = lowline,
                         mapping = aes(ymin = after_stat(y), ymax = Inf),
                         fill = 'lightblue', alpha = 0.5, color="transparent", inherit.aes = FALSE)
        }
        
        # 
        #       }  else  if (low[2]>0&&high[2]>0) {
        #         #left trapezoid
        #         print("left trapezoid")
        #       # xbl <- ifelse((ymin - low[1])/low[2]>0, (ymin - low[1])/low[2],0)
        #       # xul <- ((ymax - low[1])/low[2]) %% 365
        #       # yminlu <- ifelse((ymin - low[1])/low[2]>0, ymin, low[1])
        #       # xbr <- ifelse((ymin - high[1])/high[2]>0, (ymin - high[1])/high[2],0)
        #       # xur <- ((ymax - high[1])/high[2]) %% 365
        #       # yminlr <- ifelse((ymin - high[1])/high[2]>0, ymin, high[1])
        #       #
        #       # x <- c(xbl, xbr, xur, xul)
        # #
        #       # trapezoid <- data.frame(
        #       #   x = as.Date(x, origin = "1970-01-01"),
        #       #   y = c(yminlu, yminlr, ymax, ymax)
        #       # )
        #       # p <- p + geom_polygon(data = trapezoid, aes(x = x, y = y), fill = "gray", alpha = 0.4,inherit.aes = FALSE)
        # 
        #        } else if (high[2]<0&&low[2]<0) {
        #         # right trapezoid
        #         print("right trapezoid")
        #         # xbl <- ifelse((ymin - low[1])/low[2] < 365, (ymin - low[1])/low[2], 365)
        #         # yminrd <- ifelse((ymin - low[1])/low[2] < 365, ymin, 365*low[2]+low[1])
        #         # xul <- ((ymax - low[1])/low[2])
        #         #
        #         # xbr <- ifelse((ymin - high[1])/high[2] < 365, (ymin - high[1])/high[2], 365)
        #         # xur <- ((ymax - high[1])/high[2])
        #         # yminru <- ifelse((ymin - high[1])/high[2] < 365, ymin, 365*high[2]+high[1])
        #         #
        #         # x <- c(xbl, xbr, xur, xul)
        #         #
        #         # trapezoid <- data.frame(
        #         #   x = as.Date(x, origin = "1970-01-01"),
        #         #   y = c(yminrd, yminru, ymax, ymax)
        #         # )
        #         # p <- p + geom_polygon(data = trapezoid, aes(x = x, y = y), fill = "gray", alpha = 0.4,inherit.aes = FALSE)
        #       }
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
    sexemparam <- doyLatCalc(sexem)
    dateText(sexemparam, input$lat, "adults of the sexual generation are expected to emerge")
  })
  output$sexrearRange <- renderText({
    req(any(match()$generation=="sexgen"))
    select <- match()
    sexrear <- filter(select, viability == "viable" & generation == "sexgen")
    sexrearparam <- doyLatCalc(sexrear)
    dateText(sexrearparam, input$lat, "galls of the sexual generation can likely be successfully collected for rearing")
  })
  output$agemRange <- renderText({
    req(any(match()$generation=="agamic"))
    select <- match()
    agem <- filter(select, phenophase %in% c("maturing", "perimature", "Adult") & generation == "agamic")
    agemparam <- doyLatCalc(agem)
    return(dateText(agemparam, input$lat, "adults of the agamic generation are expected to emerge"))
  })
  output$agrearRange <- renderText({
    req(any(match()$generation=="agamic"))
    select <- match()
    agrear <- filter(select, viability == "viable" & generation == "agamic")
    agrearparam <- doyLatCalc(agrear)
    return(dateText(agrearparam, input$lat, "galls of the agamic generation can likely be successfully collected for rearing"))
  })
  output$emRange <- renderText({
    req(any(is.na(match()$generation))|any(match()$generation==""))
    select <- match()
    em <- filter(select, phenophase %in% c("maturing", "perimature", "Adult") & (is.na(generation)|generation == "NA"))
    emparam <- doyLatCalc(em)
    return(dateText(emparam, input$lat, "adults are expected to emerge"))
  })
  output$rearRange <- renderText({
    req(any(is.na(match()$generation))|any(match()$generation==""))
    select <- match()
    rear <- filter(select, viability == "viable" & (is.na(generation) | generation == "NA"))
    rearparam <- doyLatCalc(rear)
    return(dateText(rearparam, input$lat, "galls can likely be successfully collected for rearing"))
  })
  
  output$brush_info <- renderDT({
    brushed_data <- brushedPoints(plotted(), input$plot1_brush)
    brushed_data_reordered <- brushed_data[,c("obs_id","binom","phenophase","lifestage","viability", "host","doy", "date","latitude","longitude", "sourceURL","pageURL")]
    DT::datatable(brushed_data_reordered,
                  rownames = FALSE,
                  escape = FALSE,
                  options = list(
                    columnDefs = list(
                      list(targets = 10,
                           render = JS("function(data, type, row, meta) {\n if (type === 'display') {\n return '<a href=' + data + ' target=\\'_blank\\'>' + data + '</a>';\n } else {\n return data;\n }\n }")),
                      list(targets = 11,
                           render = JS("function(data, type, row, meta) {\n if (type === 'display') {\n return '<a href=' + data + ' target=\\'_blank\\'>' + data + '</a>';\n } else {\n return data;\n }\n }"))
                    )))
  })
  
  output$brush_list <- renderDT({
    brushed_data <- brushedPoints(plotted(), input$plot1_brush)
    # Apply URL transformation
    brushed_data <- brushed_data %>%
      mutate(link = paste0("<a href=", gfURL, ">", binom, "</a>"))
    
    # Create datatable object
    unique_binoms <- sort(unique(brushed_data$link))
    
    if (length(unique_binoms) == 0) {
      unique_binoms <- "No data available"
    }
    data <- data.frame(unique_binoms)
    colnames(data) <- "Species"
    DT::datatable(data, rownames = FALSE, escape = FALSE) 
  })
  
  species_data <- reactive({
    
    if (input$correct) {
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
  
  output$species_table <- renderDT({
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
      filename = "selectedData.csv",
      content = function(file) {
        if (input$mode == "Select species from plot") {
          brushed_data <- brushedPoints(plotted(), input$plot1_brush)
          unique_binoms <- sort(unique(brushed_data$binom))
          write.csv(unique_binoms, file, row.names = FALSE)
        } else if (input$mode == "View data points") {
          brushed_data <- brushedPoints(plotted(), input$plot1_brush)
          brushed_data_reordered <- brushed_data[,c("obs_id","binom","phenophase","lifestage","viability", "host","doy", "date","latitude","longitude", "sourceURL","pageURL")]
          write.csv(brushed_data_reordered, file, row.names = FALSE)
        } else if (input$mode == "List species"){
          write.csv(species_data()$binom, file, row.names = FALSE)
        } else {
          return(NULL)
        }
      }
    )
  
}
shinyApp(ui = ui, server = server)
