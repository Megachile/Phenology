library(shiny)
library(shinyjs)
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
        
      } else {
        var <- "acchours"
        left <-  min(df$acchours)
        right <-  max(df$acchours)
        thr <- ((left+right)/2)*0.08
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
  if ((df$highslope+df$lowslope)!=0){
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
wd <- "C:/Users/adam/Documents/GitHub/Phenology"
setwd(wd)
eas <- read.csv(paste0(wd, "/phenogrid.csv" ))
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
      actionButton("button", "Go"),
    ),
    mainPanel(
      plotOutput("plot"),
      textOutput("blank"),
      textOutput("sexrearRange"),
      textOutput("sexemRange"),
      textOutput("agrearRange"),  
      textOutput("agemRange"),
      textOutput("rearRange"),      
      textOutput("emRange"),
    )
  )
)

server <- function(input, output) {
  observeEvent(input$button, {
  
  select <- observations[(grepl(input$species, observations$binom,ignore.case=TRUE)),]
  
  if (dim(select)[1]>1){
    hide("blank")
    output$plot <- renderPlot({
  # min <- min(select$latitude)
  # max <- max(select$latitude)
  
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
    if (any(grepl("sexgen", select$generation))|any(grepl("agamic", select$generation))) {
    output$sexemRange <- renderText({
      return(dateText(sexemparam, input$lat, "adults of the sexual generation are expected to emerge"))
    })
    output$sexrearRange <- renderText({
      return(dateText(sexrearparam, input$lat, "galls of the sexual generation can likely be successfully collected for rearing"))
    })
    output$agemRange <- renderText({
      return(dateText(agemparam, input$lat, "adults of the agamic generation are expected to emerge"))
    })
    output$agrearRange <- renderText({
      return(dateText(agrearparam, input$lat, "galls of the agamic generation can likely be successfully collected for rearing"))
    })
    } 
    else {
    output$emRange <- renderText({
      return(dateText(emparam, input$lat, "adults are expected to emerge"))
    })
    output$rearRange <- renderText({
      return(dateText(rearparam, input$lat, "galls can likely be successfully collected for rearing"))
    })
    }
    show("plot")
    show("sexrearRange")
    show("sexemRange")
    show("agrearRange")
    show("agemRange")
    show("rearRange")   
    show("emRange")
    } 

  else{
    output$blank <- renderText("There are no observations matching this query")
    show("blank")
    hide("plot")
    hide("sexrearRange")
    hide("sexemRange")
    hide("agrearRange")
    hide("agemRange")
    hide("rearRange")   
    hide("emRange")
  }
  })
  
  
  
}
shinyApp(ui = ui, server = server)