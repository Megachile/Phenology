library(shiny)
library(dplyr)
library(lubridate)
library(ggplot2)
library(shinyjs)
library(shinyWidgets)
library(data.table)
library(stringr)
library(DT)

doyLatCalc <- function (df){
  if (dim(df)[1]>0){
    
    doy <- sort(df$doy)
    x <- df[sort(df$doy),]
    if (dim(x)[1]==1){
      left <- 0.9*df$seasind[1]
      right <- ifelse(1.1 * df$seasind[1] > 1, 1, 1.1 * df$seasind[1])
      var <- "seasind"
      thr <- 0.02
    } else {
      # Compute the differences between successive elements
      diffs <- diff(doy)
      # Find the maximum difference
      max_diff <- max(diffs)
      
      
      range <- max(df$doy, na.rm=TRUE) - min(df$doy, na.rm=TRUE)
      
      
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
        if (range>48){
          var <- "acchours"
          left <-  min(df$acchours)
          right <-  max(df$acchours)
          
          thr <- ((left+right)/2)*0.12
        }
        else {
          var <- "seasind"
          left <- min(df$seasind)
          right <- max(df$seasind)
          thr <- 0.02
        }
      }
    }
    
    y <- eas
    y <- distinct(y)
    
    tf <- y[which(between(y[[var]],(left-thr),(left+thr)  )),]
    tf <- unique(tf)
    # Group the data by y value
    tf_grouped <- tf %>% group_by(latitude)
    
    # Remove all but the point with the lowest x value for each group
    tf <- tf_grouped %>% filter(doy == max(doy))
    
    if (dim(tf)[1]>1){
      mod <- lm(tf$latitude~tf$doy)
      low <- coefficients(mod)
    } else {
      low <- c(-9999,0)
    }
    
    tf <- y[which(between(y[[var]],(right-thr),(right+thr)  )),]
    tf <- unique(tf)
    # Group the data by latitude
    tf_grouped <- tf %>% group_by(latitude)
    # Remove all but the point with the lowest doy value for each group
    tf <- tf_grouped %>% filter(doy == min(doy))
    
    if (dim(tf)[1]>1){
      mod <- lm(tf$latitude~tf$doy)
      high <- coefficients(mod)
    } else {
      high <- c(-9999,0)
    }
    
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

eas <- read.csv("phenogrid.csv")
observations <- read.csv("observations.csv")

shapes <- c(0,1,17,2,18,8)
names(shapes) <- c('dormant','developing','maturing','perimature','Adult','oviscar')


ui <- fluidPage(
  useShinyjs(),
  # App title ----
  titlePanel("When does a species emerge?"),
  sidebarLayout(
    sidebarPanel(
      textInput("species",label="Search within results by character string", value = ""),
      sliderInput("lat", label="What latitude are you interested in?", min = 20, max=55, value = 40),
      radioButtons("gen",label="Filter by generation:", choices = c("sexgen","agamic","all"),selected = "all"),
      multiInput("phen",label="Filter by phenophase:", choices = c("developing","dormant","maturing","perimature"),selected = c("developing","dormant","maturing","perimature")),
      actionButton("button", "Go"),
    ),
    mainPanel(
      plotOutput(outputId = "plot",
                 brush = brushOpts(
                   id = "plot1_brush")),
      textOutput("no_data"),
      textOutput("sexrearRange"),
      textOutput("sexemRange"),
      textOutput("agrearRange"),
      textOutput("agemRange"),
      textOutput("rearRange"),
      textOutput("emRange"),
      # verbatimTextOutput("brush_info"),
      dataTableOutput("brush_info"),
    )
  )
)

server <- function(input, output) {
  
  # match <- eventReactive(input$button, {
  #   observations[grepl(input$species, observations$binom, ignore.case= TRUE),]
  # })
  
  match <- eventReactive(input$button, {
    if(input$gen %in% c("sexgen", "agamic")) {
      observations %>% 
        filter(grepl(input$species, binom, ignore.case = TRUE) & generation == input$gen)
    } else {
      observations %>% 
        filter(grepl(input$species, binom, ignore.case = TRUE))
    }
  })
  
  output$no_data <- renderText({
    if (nrow(match())==0) 
    {"There are no observations matching this query."}
    else {""}
  })
  
  # min <- min(select$latitude)
  # max <- max(select$latitude)
  
  output$plot <- renderPlot({
    req(nrow(match())>0)
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
    
    # Assign colors to different groups of points
    select$color <- ifelse(select$generation == "agamic", "agamic",
                           ifelse(select$generation =="sexgen","sexgen","NA"))
    
    # Assign alpha to different groups of points
    select$lifestage[select$lifestage == ""] <- NA
    for (i in 1:dim(select)[1]){
      select$alpha[i] <- ifelse(isTRUE(!is.na(select$lifestage[i]) | select$viability[i] == "viable"), 1, 0.2)
    }
    
    p = ggplot(data = select, aes(x = doy, y = latitude, color = color, shape=phenophase,size=22, alpha = alpha)) +
      geom_point()+
      ylim(20,55)+
      # ylim(ymin,ymax)+
      scale_color_manual(values = c("NA"="black","sexgen" = "blue", "agamic"="red"))+
      scale_shape_manual(values=shapes)+
      geom_hline(yintercept=input$lat)+
      geom_abline(intercept = sexrearparam$lowyint[1], slope=sexrearparam$lowslope[1], linetype="dotted", color="blue")+
      geom_abline(intercept = sexrearparam$highyint[1], slope=sexrearparam$highslope[1], linetype="dotted", color="blue")+
      geom_abline(intercept = sexemparam$lowyint[1], slope=sexemparam$lowslope[1], color="blue")+
      geom_abline(intercept = sexemparam$highyint[1], slope=sexemparam$highslope[1], color="blue")+
      geom_abline(intercept = agrearparam$lowyint[1], slope=agrearparam$lowslope[1], linetype="dotted", color="red")+
      geom_abline(intercept = agrearparam$highyint[1], slope=agrearparam$highslope[1], linetype="dotted", color="red")+
      geom_abline(intercept = agemparam$lowyint[1], slope=agemparam$lowslope[1], color="red")+
      geom_abline(intercept = agemparam$highyint[1], slope=agemparam$highslope[1], color="red")+
      geom_abline(intercept = rearparam$lowyint[1], slope=rearparam$lowslope[1], linetype="dotted", color="black")+
      geom_abline(intercept = rearparam$highyint[1], slope=rearparam$highslope[1], linetype="dotted", color="black")+
      geom_abline(intercept = emparam$lowyint[1], slope=emparam$lowslope[1], color="black")+
      geom_abline(intercept = emparam$highyint[1], slope=emparam$highslope[1], color="black")+
      xlim(0,365)
    return(p)
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
    brushed_data <- brushedPoints(match(), input$plot1_brush)
    brushed_data_reordered <- brushed_data[,c("obs_id","binom","phenophase","lifestage","viability", "host", "date","latitude","longitude", "sourceURL","pageURL")]
    DT::datatable(brushed_data_reordered,
                  rownames = FALSE,
                  escape = FALSE,
                  options = list(
                    columnDefs = list(
                      list(targets = 9,
                           render = JS("function(data, type, row, meta) {\n if (type === 'display') {\n return '<a href=' + data + ' target=\\'_blank\\'>' + data + '</a>';\n } else {\n return data;\n }\n }")),
                      list(targets = 10,
                           render = JS("function(data, type, row, meta) {\n if (type === 'display') {\n return '<a href=' + data + ' target=\\'_blank\\'>' + data + '</a>';\n } else {\n return data;\n }\n }"))
                    )))
  })
  
  # output$brush_info <- renderDataTable({
  # brushed_data <- brushedPoints(match(), input$plot1_brush)
  # brushed_data_reordered <- brushed_data[,c("binom","phenophase","lifestage","viability", "host", "date","latitude","longitude", "sourceURL","pageURL")]
  # datatable(brushed_data_reordered)
  # })
}
shinyApp(ui = ui, server = server)