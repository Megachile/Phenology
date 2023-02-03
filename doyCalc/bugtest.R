wd <- "C:/Users/adam/Documents/GitHub/Phenology"
setwd(wd)
observations <- read.csv("observations.csv")
eas <- read.csv("phenogrid.csv")
select <- observations

# sexrear <- filter(select, viability == "viable" & generation == "sexgen")
# sexem <- filter(select, phenophase %in% c("maturing", "perimature", "Adult") & generation == "sexgen")
agrear <- filter(select, viability == "viable" & generation == "agamic")
agem <- filter(select, phenophase %in% c("maturing", "perimature", "Adult") & generation == "agamic")
# rear <- filter(select, viability == "viable" & (is.na(generation) | generation == "NA"))
# em <- filter(select, phenophase %in% c("maturing", "perimature", "Adult") & (is.na(generation)|generation == "NA"))

# sexrearparam <- doyLatCalc(sexrear)
# sexemparam <- doyLatCalc(sexem)
agrearparam <- doyLatCalc(agrear)
agemparam <- doyLatCalc(agem)
# rearparam <- doyLatCalc(rear)
# emparam <- doyLatCalc(em)

select[select$doy > 365,]

plotted <- select

plotted$color <- ifelse(plotted$generation == "agamic", "agamic",
                        ifelse(plotted$generation =="sexgen","sexgen","Blank"))

failed <- plotted[is.na(plotted$color),]

print(paste("Rows missing color:", sum(is.na(plotted$color))))


df <- agem
doyLatCalc <- function (df){
  if (dim(df)[1]>0){
    
    
    if (dim(df)[1]==1){
      left <- 0.9*df$seasind[1]
      right <- ifelse(1.1 * df$seasind[1] > 1, 1, 1.1 * df$seasind[1])
      var <- "seasind"
      thr <- 0.02
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
    
    y <- eas %>% select(-longitude)
    y <- distinct(y)
    
    tf <- y[which(between(y[[var]],(left-thr),(left+thr)  )),]
    tf <- unique(tf)
    # Group the data by y value
    tf <- tf %>% group_by(latitude)
    

    if (dim(tf)[1]>2){
      # Remove all but the point with the lowest x value for each group
      tf <- tf %>% filter(doy == max(doy))
      mod <- lm(tf$latitude~tf$doy)
      plot(tf$latitude~tf$doy)
      low <- coefficients(mod)
    } else {
      low <- c(-9999,0)
    }
    
    tf <- y[which(between(y[[var]],(right-thr),(right+thr)  )),]
    tf <- unique(tf)
    # Group the data by latitude
    tf <- tf %>% group_by(latitude)
    tf <- tf %>% filter(doy == min(doy))
    
    if (dim(tf)[1]>2){
      # Remove all but the point with the lowest doy value for each group

      mod <- lm(tf$latitude~tf$doy)
      plot(tf$latitude~tf$doy)
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
