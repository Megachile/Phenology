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
    print(paste("Range is", max(df$seasind)-min(df$seasind)))
    print(paste("min Seasind is", min(df$seasind)))
     if ((max(df$seasind)-min(df$seasind)<0.07)&&min(df$seasind)<0.94){
      print("Narrow range corrected")
      if (max(df$doy)>171){
        print("seasind")
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
    }
    
    else {
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

  if ((lowslope<0&&highslope<0)&&abs(lowslope-highslope)<0.05) {
    print("Fixing similar slopes")
    highslope <- 10^10
    highyint <- -10^10*365 
  }
  
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
   radioButtons("mode", label="Selection mode:", choices = c("Click and drag", "Date range", "Season index"), selected = "Click and drag"),
   tags$button(
     "Explain Season Index",
     `data-toggle` = "popover",
     `data-placement` = "bottom",
     `data-html` = "true",
     title = "Season Index",
     `data-content` = "Season Index is the percent of annual daylight hours at a given latitude that have accumulated by a given day. Minimum and maximum Season Index values calculated based on the date, latitude, and threshold you select are plotted and used to filter the observations or species listed below."
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
   radioButtons("display", label="Output mode:", choices = c("Calculate dates", "View data points", "List species"), selected = "View data points"),
   radioButtons("lines", label="Plot predicted start-end dates by latitude?", choices = c("Yes","No")),
   # checkboxInput("correct",label="Correct for latitude?", value=FALSE),

   dateInput("date", label="Observation date (ignore year)", value =Sys.Date()),
   sliderInput("days", label="How many days before or after the observation do you want to look?", min = 1, max = 183, value = 10),
   sliderInput("thr", label="How far from the observation do you want to look?", min = 0.005, max = 0.5, value = 0.05),
   sliderInput("lat", label="What latitude are you interested in?", min = 8, max=65, value = 40)
   
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
      dataTableOutput("data_table"),
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
  
  observeEvent(input$display, {
    if(input$display == "Calculate dates"){
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
    if(input$display ==  "View data points"){
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
    if(input$display == "List species") {
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
    if (input$mode == "Click and drag") {
      hide("thr")
      hide("days")
      hide("date")
    } else if (input$mode == "Date range") {
      hide("thr")
      show("days")
      show("date")
    } else if (input$mode == "Season index") {
      show("thr")
      hide("days")
      show("date")
    } 
  })
  
  match <- reactive({
  if(input$gen %in% c("sexgen", "agamic")) {
    filtered_observations <- observations %>%
      filter(grepl(escapeRegex(input$species), binom, ignore.case = TRUE) & generation == input$gen)
  } else {
    filtered_observations <- observations %>%
      filter(grepl(escapeRegex(input$species), binom, ignore.case = TRUE))
  }
  
  # filtered_species_limits <- species_limits %>%
  #   filter(min_lat >= min(input$latrange) & max_lat <= max(input$latrange)) %>%
  #   filter(min_long >= min(input$longrange) & max_long <= max(input$longrange))
  # 
  # filtered_observations %>%
  #   inner_join(filtered_species_limits, by = c("binom" = "binom"))
  
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
  scale_linetype_manual(name = "Line Type", values = c("Rearing" = "dotted", "Emergence" = "solid", "Prediction Latitude" = "dashed", "Selection bounds" = "twodash"))+
  ylim(ymin,ymax)+
  scale_x_date(date_labels = "%b", limits = as.Date(c("1970-01-01", "1971-01-02")))+
  scale_color_manual(values = c("Blank"="black","sexgen" = "blue", "agamic"="red", "Selection bounds" = "green"))+
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
  guides(color = guide_legend(override.aes = list(size = 7)))+
  guides(linetype = guide_legend(override.aes = list(lwd = 0.75)))+
  labs(x = "", y = "Latitude", title = "")

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
  if (input$display == "Calculate dates") {
    p <- p + geom_hline(yintercept = input$lat, linetype = "dashed")
  } 
 if (input$mode == "Date range") {
      doy <- as.integer(format(as.Date(input$date),"%j"))
      low <- as.Date(((doy - input$days) %% 365), origin = "1970-01-01")
      high <- as.Date(((doy + input$days) %% 365), origin = "1970-01-01")
      rect <- data.frame(
        xmin = low,
        xmax = high,
        ymin=ymin,
        ymax=ymax)

      p <- p +
      # geom_rect(data = rect, aes(xmin = xmin, xmax = xmax, ymin = ymin, ymax = ymax), fill = "gray", alpha = 0.4, inherit.aes = FALSE)
       geom_vline(xintercept = low, linetype = "twodash", color="green") + geom_vline(xintercept = high, linetype = "twodash", color="green") 
    }
    if (input$mode == "Season index") {
      doy <- as.integer(format(as.Date(input$date),"%j"))
      si <- singlesi(doy, input$lat)
      min <- (si-input$thr) %% 1
      max <- (si+input$thr) %% 1
      low <- lineCalc(min, "seasind", 0.02)
      high <- lineCalc(max, "seasind", 0.02)
      p <- p + geom_abline(aes(intercept = low[1], slope=low[2]), linetype = "twodash", color="green")+
        geom_abline(aes(intercept = high[1], slope=high[2]), linetype = "twodash", color="green")

      highline  <- function(x) as.integer(format(as.Date(x),"%j"))*high[2]+high[1]
      lowline <- function(x) as.integer(format(as.Date(x),"%j"))*low[2]+low[1]

#       if (high[2]<0&&low[2]>0){
#       #  triangles
#         print("triangles in")
#         p <- p + geom_ribbon(mapping = aes(ymin = after_stat(lowline(y)), ymax = after_stat(highline(y)) ),
#                              fill = 'lightblue', alpha = 0.5, color="transparent", inherit.aes = FALSE)
# 
# 
#       } else if (high[2]>0&&low[2]<0) {
#         #triangles backwards
#         print("triangles out")
#         
#         p <- p + geom_polygon(stat = 'function', fun = highline,
#                              mapping = aes(ymin = after_stat(y), ymax = Inf),
#                              fill = 'lightblue', alpha = 0.5, color="transparent", inherit.aes = FALSE)+
#           geom_polygon(stat = 'function', fun = lowline,
#                       mapping = aes(ymin = after_stat(y), ymax = Inf),
#                       fill = 'lightblue', alpha = 0.5, color="transparent", inherit.aes = FALSE)
# }

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

  data <- reactive({
    doy <- as.integer(format(as.Date(input$date),"%j"))
    if (input$mode == "Click and drag"){
      brushed_data <- brushedPoints(plotted(), input$plot1_brush)
      return(brushed_data)
    } else if (input$mode == "Date range") {
      min <- (doy - input$days) %% 365
      max <- (doy + input$days) %% 365
      if (min > max) {
        # Values straddle 0, so flip the selection filter
        date_data <- subset(plotted(), doy <= max | doy >= min)
      } else {
        date_data <- subset(plotted(), doy >= min & doy <= max)
      }
      return(date_data) 
    } else if (input$mode == "Season index") {
      si <- singlesi(doy, input$lat)
      min <- (si-input$thr) %% 1
      max <- (si+input$thr) %% 1
      if (min > max) {
        # Values straddle 0, so flip the selection filter
        si_data <- subset(plotted(), seasind <= max | seasind >= min)
      } else {
        si_data <- subset(plotted(), seasind >= min & seasind <= max)
      }
      return(si_data) 
  }
  })
  
  species_list <- reactive({
    data <- data()
    data <- data %>%
      mutate(link = paste0("<a href=", gfURL, ">", binom, "</a>"))
    
    unique_binoms <- sort(unique(data$binom))
    
    if (length(unique_binoms) == 0) {
      unique_binoms <- "No data available"
    }
    species <- data.frame(unique_binoms)
    colnames(species) <- "Species"
    return(species)
  })
  
  output$species_table <- renderDT({  
    DT::datatable(species_list(), rownames = FALSE, escape = FALSE) 
  })
  
  output$data_table <- renderDT({  
    data <- data()
    data_reordered <- data[,c("obs_id","binom","phenophase","lifestage","viability", "host","doy", "date","latitude","longitude", "sourceURL","pageURL")]
    DT::datatable(data_reordered,
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

  output$species_count <- renderText({
    if (nrow(species_list()) == 0) {
      "There are no matching species."
    } else {
      paste("There are", nrow(species_list()), "matching species.")
    }
  })
  
  output$downloadData <- 
    downloadHandler(
      filename = "selectedData.csv",
      content = function(file) {
        if (input$display == "List species") {
          write.csv(species_list(), file, row.names = FALSE)
        } else if (input$display == "View data points") {
          data <- data()
          data_reordered <- data[,c("obs_id","binom","phenophase","lifestage","viability", "host","doy", "date","latitude","longitude", "sourceURL","pageURL")]
          write.csv(data_reordered, file, row.names = FALSE)
        } else {
          return(NULL)
        }
      }
    )

}
shinyApp(ui = ui, server = server)
