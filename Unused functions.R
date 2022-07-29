

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

# this function calls the NPN database to associate an AGDD value with each observation based on lat/long and date. 
# Automatically excludes anything before 2016 or outside US because NPN doesn't have data for them
lookUpAGDD <- function(x){
  names(x)[names(x)=="date"] <- "observed_on"
  x$currentyearend <- paste0(year(x$observed_on), "-12-31")
  
  if ("AGDD32" %in% colnames(x)){
    for (i in 1:dim(x)[1]){
      if (is.na(x$observed_on[i])==FALSE&&year(x$observed_on[i])>2015&&x$country=="USA") {
        if (is.na(x$AGDD32)[i]||x$AGDD32[i]==""||x$AGDD32[i]=="-9999"){
          x$AGDD32[i] <- npn_get_agdd_point_data('gdd:agdd',lat=paste0(x$latitude[i]),long=paste0(x$longitude[i]),date=paste0(x$observed_on[i]),store_data = FALSE)
        } else {
          x <- x
        }  
      } else {
        x$AGDD32[i] <- NA
      }
    }
  } else {
    for (i in 1:dim(x)[1]){
      if (is.na(x$observed_on[i])==FALSE&&year(x$observed_on[i])>2015&&x$country=="USA") {
        x$AGDD32[i]  <- npn_get_agdd_point_data('gdd:agdd',lat=paste0(x$latitude[i]),long=paste0(x$longitude[i]),date=paste0(x$observed_on[i]),store_data = FALSE)
      } else {
        x$AGDD32[i] <- NA
      }
    }
  }
  
  if ("yearend32" %in% colnames(x)){
    for (i in 1:dim(x)[1]){
      if (is.na(x$observed_on[i])==FALSE&&between(year(x$observed_on[i]),2016,2021)&&x$country=="USA") {
        if (is.na(x$yearend32)[i]||x$yearend32[i]==""||x$yearend32[i]=="-9999"){
          x$yearend32[i] <- npn_get_agdd_point_data('gdd:agdd',lat=paste0(x$latitude[i]),long=paste0(x$longitude[i]),date=paste0(x$currentyearend[i]),store_data = FALSE)
        } else {
          x <- x
        }
      } else {
        x$yearend32[i] <- NA
      }
    }
  } else {
    for (i in 1:dim(x)[1]){
      if (is.na(x$observed_on[i])==FALSE&&between(year(x$observed_on[i]),2016,2021)&&x$country=="USA") {
        x$yearend32[i]  <- npn_get_agdd_point_data('gdd:agdd',lat=paste0(x$latitude[i]),long=paste0(x$longitude[i]),date=paste0(x$currentyearend[i]),store_data = FALSE)
      } else {
        x$yearend32[i] <- NA
      }
    }
  }
  
  if ("AGDD50" %in% colnames(x)){
    for (i in 1:dim(x)[1]){
      if (is.na(x$observed_on[i])==FALSE&&year(x$observed_on[i])>2015&&x$country=="USA") {
        if (is.na(x$AGDD50)[i]||x$AGDD50[i]==""||x$AGDD50[i]=="-9999"){
          x$AGDD50[i] <- npn_get_agdd_point_data('gdd:agdd_50f',lat=paste0(x$latitude[i]),long=paste0(x$longitude[i]),date=paste0(x$observed_on[i]),store_data = FALSE)
        } else {
          x <- x
        }
      } else {
        x$AGDD50[i] <- NA
      }
    }
  } else {
    for (i in 1:dim(x)[1]){
      if (is.na(x$observed_on[i])==FALSE&&year(x$observed_on[i])>2015&&x$country=="USA") {
        x$AGDD50[i]  <- npn_get_agdd_point_data('gdd:agdd_50f',lat=paste0(x$latitude[i]),long=paste0(x$longitude[i]),date=paste0(x$observed_on[i]),store_data = FALSE)
      } else {
        x$AGDD50[i] <- NA
      }
    }
  }
  
  if ("yearend50" %in% colnames(x)){
    for (i in 1:dim(x)[1]){
      if (is.na(x$observed_on[i])==FALSE&&between(year(x$observed_on[i]),2016,2021)&&x$country=="USA") {
        if (is.na(x$yearend50)[i]||x$yearend50[i]==""||x$yearend50[i]=="-9999"){
          x$yearend50[i] <- npn_get_agdd_point_data('gdd:agdd_50f',lat=paste0(x$latitude[i]),long=paste0(x$longitude[i]),date=paste0(x$currentyearend[i]),store_data = FALSE)
        } else {
          x <- x
        }
      } else {
        x$yearend50[i] <- NA
      }
    }
  } else {
    for (i in 1:dim(x)[1]){
      if (is.na(x$observed_on[i])==FALSE&&between(year(x$observed_on[i]),2016,2021)&&x$country=="USA") {
        x$yearend50[i]  <- npn_get_agdd_point_data('gdd:agdd_50f',lat=paste0(x$latitude[i]),long=paste0(x$longitude[i]),date=paste0(x$currentyearend[i]),store_data = FALSE)
      } else {
        x$yearend50[i] <- NA
      }
    }
  }
  x$AGDD32 <- replace(x$AGDD32, which(x$AGDD32 < 0), NA)
  x$AGDD50 <- replace(x$AGDD50, which(x$AGDD50 < 0), NA)
  x$yearend32 <- replace(x$yearend32, which(x$yearend32 < 0), NA)
  x$yearend50 <- replace(x$yearend50, which(x$yearend50 < 0), NA)
  x[is.nan(x$AGDD32),c("AGDD32","yearend32","yearend50",
                       "AGDD50")] <- NA
  x$percent32 <- x$AGDD32/x$yearend32
  x$percent50 <- x$AGDD50/x$yearend50
  x$currentyearend <- NULL
  names(x)[names(x)=="observed_on"] <- "date"
  return(x)
}

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

