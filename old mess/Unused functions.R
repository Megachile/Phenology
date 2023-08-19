

doyLatPlantSeasEq <- function(x,y){ 
  x <- as.data.frame(x)
  # x$phenostage <- paste0(x$phenophase, x$lifestage)
  # x <- x[!x$phenophase=="senescent",]
  # x <- x[!x$phenostage=="",]
  # x <- x[!x$phenophase=="developing",]  
  # x <- x[!x$phenophase=="dormant",] 
  x <- x[grepl('Flower Budding',x$phenophase),]
  x <- x[!is.na(x$seasind),]
  x <- x[!is.nan(x$seasind),]
  thr <- 0.01
  m <- mean(x$seasind, na.rm=TRUE)
  s <- sd(x$seasind, na.rm=TRUE)
  tf <- y[which(between(y$seasind,((m-thr)-(2*s)),((m+thr)-(2*s)))),]
  mod <- lm(tf$latitude~tf$doy)
  coef <- coefficients(mod)
  lowslope <- coef[2]
  lowyint <- coef[1]
  
  tf <- y[which(between(y$seasind,((m-thr)+(2*s)),((m+thr)+(2*s)))),]
  mod <- lm(tf$latitude~tf$doy)
  coef <- coefficients(mod)
  highslope <- coef[2]
  highyint <- coef[1]
  
  param <- as.data.frame(t(c(lowslope,lowyint,highslope,highyint)))
  colnames(param) <- c("lowslope","lowyint","highslope","highyint")
  
  return(param)
}

x <- twenty











# calculates the slope and y intercept of the lines representing two sds above and below the mean AGDD of maturing, adult, perimature observations
# a lot of late perimature observations tend to shift this too late 

doyLatEq <- function(x,y){ 
  x <- as.data.frame(x)
  x$phenostage <- paste0(x$phenophase, x$lifestage)
  x <- x[!x$phenophase=="senescent",]
  x <- x[!x$phenostage=="",]
  x <- x[!x$phenophase=="developing",]  
  x <- x[!x$phenophase=="dormant",] 
  x <- x[!x$phenophase=="oviscar",]
  x <- x[!is.na(x$AGDD32),]
  x <- x[!is.nan(x$AGDD32),]
  
  if (!all(x$generation=="NA")) { 
    if (any(grepl("agamic",x$generation))){
      m <- mean(x[which(x$generation=="agamic"),"AGDD32"])
      s <- sd(x[which(x$generation=="agamic"),"AGDD32"])
      
      tf <- y[which(between(y$AGDD32,((m-50)-(2*s)),((m+50)-(2*s)))),]
      mod <- lm(tf$latitude~tf$doy)
      coef <- coefficients(mod)
      agamlowslope <- coef[2]
      agamlowyint <- coef[1]
      
      tf <- y[which(between(y$AGDD32,((m-50)+(2*s)),((m+50)+(2*s)))),]
      if (dim(tf)[1]>1){
        mod <- lm(tf$latitude~tf$doy)
        coef <- coefficients(mod)
        agamhighslope <- coef[2]
        agamhighyint <- coef[1]
      } else {
        agamhighslope <- 9999
        agamhighyint <- -9999
      }
    } else {
      agamhighslope <- 9999
      agamhighyint <- -9999
      agamlowslope <- 9999
      agamlowyint <- -9999
    }
    if (any(grepl("sexgen",x$generation))){
      m <- mean(x[which(x$generation=="sexgen"),"AGDD32"])
      s <- sd(x[which(x$generation=="sexgen"),"AGDD32"])
      
      tf <- y[which(between(y$AGDD32,((m-50)-(2*s)),((m+50)-(2*s)))),]
      mod <- lm(tf$latitude~tf$doy)
      coef <- coefficients(mod)
      sglowslope <- coef[2]
      sglowyint <- coef[1]
      
      tf <- y[which(between(y$AGDD32,((m-50)+(2*s)),((m+50)+(2*s)))),]
      if (dim(tf)[1]>1){
        mod <- lm(tf$latitude~tf$doy)
        coef <- coefficients(mod)
        sghighslope <- coef[2]
        sghighyint <- coef[1]
      } else {
        sghighslope <- 9999
        sghighyint <- -9999
      } 
    } else {
      sghighslope <- 9999
      sghighyint <- -9999
    }
    
    param <- as.data.frame(t(c(agamlowslope,agamlowyint,agamhighslope,agamhighyint,sglowslope,sglowyint,sghighslope,sghighyint)))
    colnames(param) <- c("agamlowslope","agamlowyint","agamhighslope","agamhighyint","sglowslope","sglowyint","sghighslope","sghighyint")
    
  } else {
    
    m <- mean(x$AGDD32, na.rm=TRUE)
    s <- sd(x$AGDD32, na.rm=TRUE)
    tf <- y[which(between(y$AGDD32,((m-50)-(2*s)),((m+50)-(2*s)))),]
    mod <- lm(tf$latitude~tf$doy)
    coef <- coefficients(mod)
    lowslope <- coef[2]
    lowyint <- coef[1]
    
    tf <- y[which(between(y$AGDD32,((m-50)+(2*s)),((m+50)+(2*s)))),]
    mod <- lm(tf$latitude~tf$doy)
    coef <- coefficients(mod)
    highslope <- coef[2]
    highyint <- coef[1]
    
    param <- as.data.frame(t(c(lowslope,lowyint,highslope,highyint)))
    colnames(param) <- c("lowslope","lowyint","highslope","highyint")
    
    
  }
  return(param)
}

# same as above but with percent32 AGDD
doyLatPercentEq <- function(x,y){ 
  x <- as.data.frame(x)
  x$phenostage <- paste0(x$phenophase, x$lifestage)
  x <- x[!x$phenophase=="senescent",]
  x <- x[!x$phenostage=="",]
  x <- x[!x$phenophase=="developing",]  
  x <- x[!x$phenophase=="dormant",] 
  x <- x[!x$phenophase=="oviscar",]
  x <- x[!is.na(x$percent32),]
  x <- x[!is.nan(x$percent32),]
  thr <- 0.01
  if (!all(x$generation=="NA")) { 
    if (any(grepl("agamic",x$generation))){
      m <- mean(x[which(x$generation=="agamic"),"percent32"])
      s <- sd(x[which(x$generation=="agamic"),"percent32"])
      
      tf <- y[which(between(y$percent32,((m-thr)-(2*s)),((m+thr)-(2*s)))),]
      mod <- lm(tf$latitude~tf$doy)
      coef <- coefficients(mod)
      agamlowslope <- coef[2]
      agamlowyint <- coef[1]
      
      tf <- y[which(between(y$percent32,((m-thr)+(2*s)),((m+thr)+(2*s)))),]
      if (dim(tf)[1]>1){
        mod <- lm(tf$latitude~tf$doy)
        coef <- coefficients(mod)
        agamhighslope <- coef[2]
        agamhighyint <- coef[1]
      } else {
        agamhighslope <- 9999
        agamhighyint <- -9999
      }
    } else {
      agamhighslope <- 9999
      agamhighyint <- -9999
      agamlowslope <- 9999
      agamlowyint <- -9999
    }
    if (any(grepl("sexgen",x$generation))){
      m <- mean(x[which(x$generation=="sexgen"),"percent32"])
      s <- sd(x[which(x$generation=="sexgen"),"percent32"])
      
      tf <- y[which(between(y$percent32,((m-thr)-(2*s)),((m+thr)-(2*s)))),]
      mod <- lm(tf$latitude~tf$doy)
      coef <- coefficients(mod)
      sglowslope <- coef[2]
      sglowyint <- coef[1]
      
      tf <- y[which(between(y$percent32,((m-thr)+(2*s)),((m+thr)+(2*s)))),]
      if (dim(tf)[1]>1){
        mod <- lm(tf$latitude~tf$doy)
        coef <- coefficients(mod)
        sghighslope <- coef[2]
        sghighyint <- coef[1]
      } else {
        sghighslope <- 9999
        sghighyint <- -9999
      } 
    } else {
      sghighslope <- 9999
      sghighyint <- -9999
    }
    
    param <- as.data.frame(t(c(agamlowslope,agamlowyint,agamhighslope,agamhighyint,sglowslope,sglowyint,sghighslope,sghighyint)))
    colnames(param) <- c("agamlowslope","agamlowyint","agamhighslope","agamhighyint","sglowslope","sglowyint","sghighslope","sghighyint")
    
  } else {
    
    m <- mean(x$percent32, na.rm=TRUE)
    s <- sd(x$percent32, na.rm=TRUE)
    tf <- y[which(between(y$percent32,((m-.01)-(2*s)),((m+.01)-(2*s)))),]
    mod <- lm(tf$latitude~tf$doy)
    coef <- coefficients(mod)
    lowslope <- coef[2]
    lowyint <- coef[1]
    
    tf <- y[which(between(y$percent32,((m-.01)+(2*s)),((m+.01)+(2*s)))),]
    mod <- lm(tf$latitude~tf$doy)
    coef <- coefficients(mod)
    highslope <- coef[2]
    highyint <- coef[1]
    
    param <- as.data.frame(t(c(lowslope,lowyint,highslope,highyint)))
    colnames(param) <- c("lowslope","lowyint","highslope","highyint")
    
    
  }
  return(param)
}

# same as AGDD but for a plant
doyLatPlantEq <- function(x,y){ 
  x <- as.data.frame(x)
  # x$phenostage <- paste0(x$phenophase, x$lifestage)
  # x <- x[!x$phenophase=="senescent",]
  # x <- x[!x$phenostage=="",]
  # x <- x[!x$phenophase=="developing",]  
  # x <- x[!x$phenophase=="dormant",] 
  x <- x[grepl('Flower Budding',x$phenophase),]
  x <- x[!is.na(x$AGDD50),]
  x <- x[!is.nan(x$AGDD50),]
  
  m <- mean(x$AGDD50, na.rm=TRUE)
  s <- sd(x$AGDD50, na.rm=TRUE)
  tf <- y[which(between(y$AGDD50,((m-50)-(2*s)),((m+50)-(2*s)))),]
  mod <- lm(tf$latitude~tf$doy)
  coef <- coefficients(mod)
  lowslope <- coef[2]
  lowyint <- coef[1]
  
  tf <- y[which(between(y$AGDD50,((m-50)+(2*s)),((m+50)+(2*s)))),]
  mod <- lm(tf$latitude~tf$doy)
  coef <- coefficients(mod)
  highslope <- coef[2]
  highyint <- coef[1]
  
  param <- as.data.frame(t(c(lowslope,lowyint,highslope,highyint)))
  colnames(param) <- c("lowslope","lowyint","highslope","highyint")
  
  return(param)
}

# same as percent but for a plant
doyLatPlantPercentEq <- function(x,y){ 
  x <- as.data.frame(x)
  # x$phenostage <- paste0(x$phenophase, x$lifestage)
  # x <- x[!x$phenophase=="senescent",]
  # x <- x[!x$phenostage=="",]
  # x <- x[!x$phenophase=="developing",]  
  x <- x[x$phenophase=="Flower Budding",] 
  # x <- x[grepl('Flower Budding',x$phenophase),]
  
  x <- x[!is.na(x$percent50),]
  x <- x[!is.nan(x$percent50),]
  thr <- 0.01
  
  m <- mean(x$percent50, na.rm=TRUE)
  s <- sd(x$percent50, na.rm=TRUE)
  tf <- y[which(between(y$percent50,((m-thr)-(2*s)),((m+thr)-(2*s)))),]
  mod <- lm(tf$latitude~tf$doy)
  coef <- coefficients(mod)
  lowslope <- coef[2]
  lowyint <- coef[1]
  
  tf <- y[which(between(y$percent50,((m-thr)+(2*s)),((m+thr)+(2*s)))),]
  mod <- lm(tf$latitude~tf$doy)
  coef <- coefficients(mod)
  highslope <- coef[2]
  highyint <- coef[1]
  
  param <- as.data.frame(t(c(lowslope,lowyint,highslope,highyint)))
  colnames(param) <- c("lowslope","lowyint","highslope","highyint")
  
  
  
  return(param)
}

