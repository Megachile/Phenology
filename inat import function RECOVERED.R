library(jsonlite)
library(data.table)
# library(foreach)
# library(stringr)
library(tidyr)
# library(purrr)
# library(iNatTools)
# library(remotes)
# library(rinat)
library(lubridate)
library(dplyr)
library(plyr)
library(ddpcr)
library(rnpn)
library(ggplot2)
library(ggpmisc)
library(solrad)
# library(units)
# library(stats)
library(pracma)
library(DBI)
library(stringr)
wd <- "C:/Users/adam/Documents/GitHub/Phenology"
setwd(wd)
gallphen <- dbConnect(RSQLite::SQLite(), "gallphen.sqlite")
prev <- read.csv(paste0(wd, "/USgridagdd.csv" ))
eas <- prev[prev$longitude>-103,]
eas <- eas[!is.na(eas$AGDD32),]
pac <- prev[!(prev$longitude>-103),]
pac <- pac[!is.na(pac$AGDD32),]


#input iNat code or GF code
spcode <- "1080114"

#generate a URL for that code, after last fetched date for that code
url <- urlMaker(spcode)

#limit to only observations with plant phenology (for plant observations only)
# url <- paste0(url, "&term_id=12")

#iNat API call
obs <- iNatCall(url)

#add inat code to database if you get an error
# dbExecute(gallphen, "UPDATE species SET inatcode = 1394743
# WHERE genus = 'Bassettia' AND species LIKE '%flavipes%'")

# remove any rows with IDs in the baddata table or already present in the observations table. Eliminates any records that are not new. 
# only works for iNat inputs, do not run on other data!
new <- checkData(obs)

# creates a *new* dataframe with only rows missing data
# 
# missing <- findMissing(new)

# for (i in 1:20){
#   browseURL(missing$uri[i])
# }

prob <- #####
# new[new$id==prob,"Gall_phenophase"] <- "dormant"
# new[new$id==prob,"Gall_generation"] <- "unisexual"
# new[new$id==prob,"Host_Plant_ID"] <- "49006"
# new[new$id==prob,"Life_Stage"] <- "Larva"

# egg <- findEgg(new)

# for (i in 1:20){
#   browseURL(egg$uri[i])
# }

# new[new$Gall_phenophase=="Egg","Gall_phenophase"] <- NA

#get AGDD
agdd <- lookUpAGDD(new)

checkHost(agdd)
# 
# dbExecute(gallphen, "UPDATE species SET inatcode = '119269'
#            WHERE genus = 'Quercus' AND species = 'stellata'")

#remove and add columns to match database table
append <- PrepAppend(agdd)

lit <- read.csv(paste0(wd,"/litdates5.csv"))
lit <- lit[!is.na(lit$gall_id),]
for (i in 1:dim(lit)[1]){
  if (is.na(lit$doy[i])){
    lit$doy[i] <- yday(lit$date[i])
  }}

#add to the database
dbAppendTable(gallphen, "observations",)
# update the last updated date to the current date
setUpdate(spcode)

dbGetQuery(gallphen, "SELECT inatcode FROM species WHERE species_id in (SELECT DISTINCT gall_id FROM observations)")

# dbGetQuery(gallphen, "SELECT * FROM observations WHERE pageURL ='https://www.inaturalist.org/observations/127280486'")

# dbExecute(gallphen, "DELETE FROM observations 
#           WHERE obs_id = ''")

#input iNat code or GF code
spcode <- "85317"

data <- dbGetQuery(gallphen, str_interp("SELECT observations.*, host.species AS host, gall.generation FROM observations 
                             LEFT JOIN species AS host ON observations.host_id = host.species_id
                             INNER JOIN species AS gall ON observations.gall_id = gall.species_id
                             WHERE gall_id in (SELECT species_id FROM species
                             WHERE inatcode = '${spcode}')"))

data <- dbGetQuery(gallphen, "SELECT * FROM observations 
                             WHERE host_id IN (SELECT species_id FROM species
                             WHERE genus = 'Solidago' AND species = 'altissima')
                              AND gall_id IS NULL")


data <- dbGetQuery(gallphen, "SELECT observations.*, host.species AS host, gall.species AS gall FROM observations 
                             LEFT JOIN species AS host ON observations.host_id = host.species_id
                             LEFT JOIN species AS gall ON observations.gall_id = gall.species_id
                             WHERE host_id in (SELECT species_id FROM species
                             WHERE genus = 'Solidago') OR gall_id = '760'")


write.csv(data, paste0(wd, "/Eurosta+solidago.csv"))



easfull <- seasonIndex(easfull)
easfull <- acchours(easfull)

data <- data[data$sourceURL=="inaturalist.org",]
eas <- seasonIndex(eas)
eas <- acchours(eas)
data <- data[!(data$doy<171&grepl('Flower Budding',data$phenophase)),]

data <- seasonIndex(data)
data <- acchours(data)
param <- doyLatSeasEq(data,eas)
param <- doyLatAGDD32Eq(data,eas)
param <- doyLatAGDD50Eq(data,eas)
doyLatPlot(data,param)


p = ggplot(data = data, aes(x = doy, y = latitude, color=phenophase, shape=phenophase,size=22)) + 
  geom_point()
p

eas <- easfull[easfull$latitude==c(49),]
eas1 <- eas[eas$doy==c(359),]
eas <- easfull


plot(eas$AGDD32~eas$doy)
plot(eas$acchours~eas$doy)
plot(eas$percent32~eas$doy)
plot(eas$seasind~eas$doy)
plot(eas$percent50~eas$seasind)
plot(eas$AGDD50~eas$AGDD32)

mod <- lm(formula = AGDD32 ~ latitude, data = eas1)
summary(mod)


# data <- data[!data$pageURL=="https://www.inaturalist.org/observations/72725154",]
param <- doyLatSeasEq(data,eas)

anom <- doyLatAnom(data, param)

anom <- data[data$phenophase=="developing"&data$doy<230,]

for (i in 1:20){
  browseURL(x$pageURL[i])
}

doyLatPlot(data,param)

data[is.na(data$lifestage),"lifestage"] <- ""




dbExecute(gallphen, "UPDATE observations SET lifestage = ''
          WHERE lifestage = 'NA' ")

# dbExecute(gallphen, "UPDATE observations SET lifestage = NULL
#           WHERE pageURL = 'https://www.inaturalist.org/observations/15533778'")
# dbExecute(gallphen, "UPDATE observations SET host_id = '329'
#           WHERE pageURL = 'https://www.inaturalist.org/observations/63399188'")
# dbExecute(gallphen, "UPDATE observations SET host_id = '325'
#           WHERE gall_id = '960'")

# enter an iNat observation ID (not a species ID!) to put it into the baddata table so it will be excluded from future imports. 
# also deletes any records with that code in the observations table
# checks to see if code is already present first so in theory it can safely be run multiple times on the same code
# markBad()

solidago <- dbGetQuery(gallphen, "SELECT * FROM observations WHERE sourceURL LIKE '%NPN%' AND host_id IN (SELECT species_id FROM species WHERE genus = 'Solidago')")

dbGetQuery(gallphen, "SELECT * FROM species WHERE species = 'michauxii'")

dbGetQuery(gallphen, "SELECT * FROM observations WHERE pageURL = 'https://www.inaturalist.org/observations/63399188'")



dbGetQuery(gallphen, "SELECT * FROM species WHERE genus = 'Quercus' and species LIKE '%coccinea%'")



#functions

# checks to see when a species (by iNat code) was last updated 
datecheck <- function(code){
  
  library(DBI)
  gallphen <- dbConnect(RSQLite::SQLite(), "gallphen.sqlite")
  if (grepl("-",code,fixed=TRUE)){
    return(dbGetQuery(gallphen, str_interp("SELECT update_date FROM specieshistory WHERE species_id = (SELECT species_id FROM species WHERE species LIKE '${code}')")))
  } else {
    return(dbGetQuery(gallphen, str_interp("SELECT update_date FROM specieshistory WHERE species_id = (SELECT species_id FROM species WHERE inatcode = '${code}')")))
  }
}

# takes either an iNat species code or a gallformers code and makes an iNat API query url 
# only fetches observations uploaded after the last update date for the species 
urlMaker <- function(code) {
  
  #loads in the database if not already loaded  
  library(DBI)
  gallphen <- dbConnect(RSQLite::SQLite(), "gallphen.sqlite")
  
  if (grepl("-",code,fixed=TRUE)){
    
    url <-
      str_interp(
        "https://api.inaturalist.org/v1/observations?quality_grade=any&identifications=any&page=1&place_id=6712%2C1&per_page=200&order=desc&order_by=created_at&any&field%3Agallformers%2Bcode=${code}"
      )
  } else {
    #checks to see if the code matches anything in the db
    match <- dbGetQuery(gallphen, str_interp("SELECT * FROM species WHERE inatcode = '${code}'"))
    if (dim(match)[1]==0) { 
      warning("iNat code does not exist in the database; please add it first")
    } else {
      
      url <-
        str_interp(
          "https://api.inaturalist.org/v1/observations?quality_grade=any&identifications=any&page=1&place_id=6712%2C1&per_page=200&order=desc&order_by=created_at&taxon_id=${code}"
        )  
    }
  }
  return(url)
}

#calls the iNat API and parses JSON into a dataframe, with a few other processing steps
iNatCall <- function(url) {
  
  ### Get annotation codes
  a <- fromJSON("https://api.inaturalist.org/v1/controlled_terms")
  a <- flatten(a$results)
  l <- lapply(seq_along(a[, "values"]), function(i) {
    cbind(idann = a$id[i], labelann = a$label[i], a[i, "values"][[1]][, c("id", "label")])
  })
  ann <- do.call("rbind", l)
  ann
  
  keep <-
    c("id", "observed_on","taxon.name", "location", "uri","ofvs","annotations","place_ids") # values to keep
  
  nobs <- NULL
  while(is.null(nobs)){
    nobs <- tryCatch(fromJSON(url),
                     error = function(e)
                       return(NULL))
    Sys.sleep(1)}
  
  npages <- ceiling(nobs$total_results / 200)
  xout <- flatten(nobs$results)
  xout <- xout[,keep]
  x <- NULL
  
  if (npages>1){
    for(i in 2:npages) {
      # Get json and flatten
      page <- paste0("&page=", i)
      while (is.null(x)){
        x <- tryCatch(fromJSON(gsub("&page=1", page, url)),
                      error = function(e)
                        return(NULL))
        Sys.sleep(1)}
      x <- flatten(x$results)
      x1 <- x[,keep]
      xout <- rbind(xout,x1)
      x <- NULL
    }}
  
  x <- xout
  
  
  
  ### Extract annotations if any
  vals <- lapply(seq_along(x$annotations), function(i) {
    j <- x$annotations[[i]]
    n <- c("controlled_attribute_id", "controlled_value_id")
    if (all(n %in% names(j))) {
      # tests if there are any annotations for the obs
      ans <- j[, n]
    } else{
      ans <-
        data.frame(x = NA, y = NA) # if no annotations create NA data.frame
      names(ans) <- n
    }
    cbind(x[i, keep][rep(1, nrow(ans)),], ans) # repeat obs for each annotation value and bind with ann
  })
  vals <- do.call("rbind", vals) # bind everything
  
  keep <-
    c(
      "id",
      "observed_on",
      "taxon.name",
      "location",
      "uri",
      "ofvs",
      "place_ids",
      "controlled_attribute_id",
      "controlled_value_id"
    ) # values to keep
  
  ### Extract observation fields if any
  
  of <- lapply(seq_along(vals$ofvs), function(i) {
    f <- vals$ofvs[[i]]
    m <- c("name", "value")
    if (all(m %in% names(f))) {
      # tests if there are any annotations for the obs
      ans <- f[, m]
    } else{
      ans <-
        data.frame(x = NA, y = NA) # if no annotations create NA data.frame
      names(ans) <- m
    }
    cbind(vals[i, keep][rep(1, nrow(ans)),], ans) # repeat obs for each annotation value and bind with ann
  })
  
  of <- do.call("rbind", of) # bind everything
  
  of$country <- sapply(of$place_ids,"[[",1)
  of$place_ids <- NULL
  of$country <- gsub("6712","Canada",of$country)
  of$country <- gsub("1","USA",of$country)
  
  ## Merge obs with annotations
  obs <-
    merge(
      of,
      ann,
      by.x = c("controlled_attribute_id", "controlled_value_id"),
      by.y = c("idann", "id"),
      all.x = TRUE
    )
  obs <- obs[order(obs$id), ]
  
  ### Cast from long to wide and concatenate annotation values
  # Results in a single line per obs
  setDT(obs) # turn df to data.table to use dcast
  obs <- dcast(
    obs,
    id + uri + observed_on + location + country + taxon.name + name + value ~ labelann,
    value.var = "label",
    fun = function(i) {
      paste(i, collapse = "; ")
    }
  )
  names(obs) <- gsub(" ", "_", names(obs)) # remove spaces from column names
  # setDT(obs) # turn df to data.table to use dcast
  if (is.null(obs$Evidence_of_Presence)){
    obs$Evidence_of_Presence <- NA
  } else {
    obs$Evidence_of_Presence <- obs$Evidence_of_Presence
  }
  if (is.null(obs$Life_Stage)){
    obs$Life_Stage <- NA
  } else {
    obs$Life_Stage <- obs$Life_Stage
  }
  if (is.null(obs$Plant_Phenology)){
    obs$Plant_Phenology <- NA
  } else {
    obs$Plant_Phenology <- obs$Plant_Phenology
  }
  
  obs <- dcast(
    obs,
    id + uri + observed_on + location + taxon.name + country + Evidence_of_Presence + Life_Stage + Plant_Phenology ~ name,
    value.var = "value",
    fun = function(i) {
      paste(i, collapse = "; ")
    }
  )
  names(obs) <- gsub(" ", "_", names(obs)) # remove spaces from column names
  
  obs <- select(obs, one_of(c("id","observed_on", "country","taxon.name","location","uri","Plant_Phenology","Evidence_of_Presence","Life_Stage","Gall_generation","Gall_phenophase","Host_Plant_ID","Rearing_viability")))
  
  ## process variables
  obs <- obs %>% separate(location, c("latitude","longitude"), ",")
  obs$doy <- yday(obs$observed_on)
  obs <- Filter(function(x)!all(is.na(x)),obs)
  return(as.data.frame(obs))
}

# checks to see if observations are in the baddata table or already in the observations table; outputs a new dataframe without those observations
checkData <- function(df){
  library(DBI)
  gallphen <- dbConnect(RSQLite::SQLite(), "gallphen.sqlite")
  
  remove <- 1:dim(df)[1]
  id <- NA
  remove <- as.data.frame(cbind(remove, id))
  for (i in 1:dim(df)[1]) {
    bad <- dbGetQuery(gallphen, str_interp("SELECT 1 FROM baddata WHERE obs_id = '${df$id[i]}'"))
    exist <- dbGetQuery(gallphen, str_interp("SELECT 1 FROM observations WHERE pageURL = '${df$uri[i]}'"))
    if (dim(bad)[1]!=0||dim(exist)[1]!=0) {
      remove$id[i] <- df$id[i]
    }
  }
  df <- df[!(df$id %in% remove$id),]
  warning(str_interp("${length(remove[!is.na(remove$id)])} observations have been removed as duplicates or bad data"))
  return(df)
}

# creates a subset of the data that are missing key values
findMissing <- function(df){
  if (!is.null(df$Plant_Phenology)){
    miss1 <- df[df$Plant_Phenology=="",]
  } 
  if (!is.null(df$Gall_generation)){
    miss2 <- df[df$Gall_generation=="",]
  }
  if (!is.null(df$Gall_phenophase)){
    miss3 <- df[df$Gall_phenophase=="",]
  }
  missing <- rbind(miss1,miss2,miss3)
  if (dim(unique(missing))[1]>20){
    warning("Many data points are missing values. You may want to go to iNat and fill them in and run the import function again rather than using this tool to fix them individually")
  }
  return(unique(missing))
}

# creates a subset of the data that are marked Life stage egg
findEgg <- function(df){
  if (!is.null(df$Life_Stage)){
    egg <- df[df$Life_Stage=="Egg",]
  }
  return(egg)
}

numbers_only <- function(x) {!grepl("\\D", x)}

# looks up all host IDs in the db and prints the ones not in the db yet
checkHost <- function(df){
  library(DBI)
  gallphen <- dbConnect(RSQLite::SQLite(), "gallphen.sqlite")
  
  hostcodes <- unique(df$Host_Plant_ID)
  host_id <- NA
  hosts <- as.data.frame(cbind(hostcodes, host_id))
  
  hosts <- hosts[!hosts$hostcodes=="",]
  

  for (i in 1:dim(hosts)[1]){
    if (numbers_only(hosts$hostcodes[i])){
      rank <- dbGetQuery(gallphen, str_interp("SELECT taxonRank FROM inatcodes WHERE id = '${hosts$hostcodes[i]}' ")) 
      if (isTRUE(rank[1,1]=="species")){
        hosts$host_id[i] <- dbGetQuery(gallphen, str_interp("SELECT species_id FROM species
                                                      WHERE inatcode = '${hosts$hostcodes[i]}'"))
      } else {
        hosts$host_id[i] <- NA
      } 
    } else { 
      hosts$host_id[i] <- dbGetQuery(gallphen, str_interp("SELECT species_id FROM species
                                                      WHERE inatcode = (SELECT id FROM commonnames WHERE vernacularName LIKE '%${hosts$hostcodes[i]}%')"))
    }
    
  }
  hosts <- hosts[numbers_only(hosts$host_id),]
  hosts <- hosts[hosts$host_id=="integer(0)",]
  if (dim(hosts)[1]!=0){
    hosts$uri <- paste0("https://www.inaturalist.org/taxa/",hosts$hostcodes)
    for (i in 1:20){
      browseURL(hosts$uri[i])
    }
  }
  return(hosts)
}

# this function renames columns and adds columns as needed go from the output of the iNat export to the input to the database.  
# Only works if column inputs are not altered
PrepAppend <- function(x){
  
  x$id <- NULL
  names(x)[names(x)=="observed_on"] <- "date"
  # x$date <- as.Date(x$date)
  x$latitude <- as.numeric(x$latitude)
  x$longitude <- as.numeric(x$longitude)
  names(x)[names(x)=="uri"] <- "pageURL"
  names(x)[names(x)=="Life_Stage"] <- "lifestage"
  x$Evidence_of_Presence <- NULL
  x$site <- NA
  x$state <- NA
  x$sourceURL <- "inaturalist.org"
  if (is.null(x$country)){
    x$country <- NA
  }
  if (is.null(x$doy)){
    x$doy <- yday(x$date)
  }
  if (is.null(x$AGDD32)){
    x$AGDD32 <- NA
  }
  if (is.null(x$AGDD50)){
    x$AGDD50 <- NA
  } 
  if (is.null(x$yearend32)){
    x$yearend32 <- NA
  }
  if (is.null(x$yearend50)){
    x$yearend50 <- NA
  } 
  if (is.null(x$percent32)){
    x$percent32 <- NA
  }
  if (is.null(x$percent50)){
    x$percent50 <- NA
  } 
  if (is.null(x$viability)){
    x$viability <- NA
  } 
  
  x <- x %>% separate(taxon.name, c("genus","species"), remove=TRUE, extra = "drop")
  
  #get database ready
  library(DBI)
  gallphen <- dbConnect(RSQLite::SQLite(), "gallphen.sqlite")
  
  # if this is a plant dataset, get the corresponding species IDs for a host and make a blank gall_id column
  if (!is.null(x$Plant_Phenology)){
    
    for (i in 1:dim(x)[1]){
      x$host_id[i] <- dbGetQuery(gallphen, str_interp("SELECT species_id FROM species
                                                      WHERE genus = '${x$genus[i]}' AND species = '${x$species[i]}'"))
    }
    x$host_id <- as.numeric(x$host_id)
    x$gall_id <- NA
  } else {
    # if this is a gall dataset, if no host data exists, make a blank host_id column, otherwise get the corresponding species IDs for each host
    if (is.null(x$Host_Plant_ID)){
      x$host_id <- NA
      
    } else {
      
      for (i in 1:dim(x)[1]){
        if (is.na(x$Host_Plant_ID[i])) {
          x$host_id[i] <- NA
        } else {
          if (numbers_only(x$Host_Plant_ID[i])){
            rank <- dbGetQuery(gallphen, str_interp("SELECT taxonRank FROM inatcodes WHERE id = '${x$Host_Plant_ID[i]}' ")) 
            if (isTRUE(rank[1,1]=="species")){
              x$host_id[i] <- dbGetQuery(gallphen, str_interp("SELECT species_id FROM species
                                                      WHERE inatcode = '${x$Host_Plant_ID[i]}'"))
            } else {
              x$host_id[i] <- NA
            } 
          } else { 
            x$host_id[i] <- dbGetQuery(gallphen, str_interp("SELECT species_id FROM species
                                                      WHERE inatcode = (SELECT id FROM commonnames WHERE vernacularName LIKE '%${x$Host_Plant_ID[i]}%')"))
          }
        }
        
        if (!numbers_only(x$host_id[i])){
          x$host_id[i] <- NA
        }
      }
    }
    x$host_id <- as.numeric(x$host_id)
    #if the generation is tagged, get gall_id for each accordingly
    if (is.null(x$Gall_generation)){
      for (i in 1:dim(x)[1]){
        x$gall_id[i] <- dbGetQuery(gallphen, str_interp("SELECT species_id FROM species
                                                      WHERE genus = '${x$genus[i]}' AND species = '${x$species[i]}'"))
      }
    } else {
      x$Gall_generation <- gsub("unisexual","agamic", x$Gall_generation)
      x$Gall_generation <- gsub("bisexual","sexgen", x$Gall_generation)
      for (i in 1:dim(x)[1]){
        x$gall_id[i] <- dbGetQuery(gallphen, str_interp("SELECT species_id FROM species
                                                      WHERE genus = '${x$genus[i]}' AND species LIKE '%${x$species[i]}%' AND generation LIKE '%${x$Gall_generation[i]}%'"))
      }
    }
    x$gall_id <- as.numeric(x$gall_id)
  }
  
  names(x)[names(x)=="Plant_Phenology"] <- "phenophase"
  names(x)[names(x)=="Gall_phenophase"] <- "phenophase"
  
  # if there was no gall phenophase, the observation is assumed to be a free-living adult and the Adult from lifestage is pasted in to phenophase
  for (i in 1:dim(x)[1]){
    if (isTRUE(x$phenophase[i]=="")){
      x$phenophase[i] <- x$lifestage[i]
    } 
  }
  
  x$genus <- NULL
  x$species <- NULL
  # names(x)[names(x)=="Gall_generation"] <- "generation"
  x$Gall_generation <- NULL
  x$Host_Plant_ID <- NULL
  return(as.data.frame(x))
}

# functions to calculate a new column for the accumulated hours (adjusted for latitude) and the percent of same (seasonality index) of each observation in a dataframe
# must contain a latitude and doy column
pos_part <- function(x) {
  return(sapply(x, max, 0))
}

eqmod = function(x,lat=49) {((2*(24/(2*pi))*acos(-tan((lat*pi/180))*tan((pi*Declination(x-(1.8*lat-50) )/180))))-(0.1*lat+5)) }

acchours <- function(x){
  
  for (i in 1:dim(x)[1]){
    x$acchours[i] <- trapz(
      seq(1,x$doy[i]),
      (pos_part(eqmod(seq(1,x$doy[i]),x$latitude[i])*(90-x$latitude[i]))
       /max(eqmod(seq(1,365),x$latitude[i])) * (-1/200*x$latitude[i]+647/600) )  
    )
  }
  return(x)
}

eq = function(x,lat=49) {((2*(24/(2*pi))*acos(-tan((lat*pi/180))*tan((pi*Declination(x)/180))))-(0.1*lat+5)) }

seasonIndex <- function(x){
  
  for (i in 1:dim(x)[1]){
    x$seasind[i] <- trapz(seq(1,x$doy[i]),(pos_part(eq(seq(1,x$doy[i]),x$latitude[i]))))/trapz(seq(1,(365)),(pos_part(eq(seq(1,(365)),x$latitude[i]))))
  }
  return(x)
}

# calculates the slope and y intercept of the lines representing two sds above and below the mean accumulated day hours or seasonality index of flower budding or maturing, adult, perimature observations
parcalc <- function(x,y,var){
  m <- mean(x[[var]],na.rm=TRUE)
  s <- sd(x[[var]],na.rm=TRUE)
  thr <- 0.025*m
  tf <- y[which(between(y[[var]],((m-thr)-(z*s)),((m+thr)-(z*s))  )),]
  if (dim(tf)[1]>1){
    mod <- lm(tf$latitude~tf$doy)
    plot(tf$latitude~tf$doy)
    low <- coefficients(mod)
  } else {
    low <- c(-9999,0)
  }
  tf <- y[which(between(y[[var]],((m-thr)+(z*s)),((m+thr)+(z*s))  )),]
  if (dim(tf)[1]>1){
    mod <- lm(tf$latitude~tf$doy)
    plot(tf$latitude~tf$doy)
    high <- coefficients(mod)
  } else {
    high <- c(-9999,0)
  }
  
  coef <- rbind(low,high)
  return(as.data.frame(coef))
}



doyLatSeasEq <- function(x,y){ 
  x <- as.data.frame(x)
  if (all(is.na(x$gall_id))){
    x <- x[grepl('Flower Budding',x$phenophase),] 
  } else {
    x$phenostage <- paste0(x$phenophase, x$lifestage)
    x <- x[!x$phenophase=="senescent",]
    x <- x[!x$phenostage=="",]
    x <- x[!x$phenophase=="developing",]
    x <- x[!x$phenophase=="dormant",]
    x <- x[!x$phenophase=="oviscar",]
  }
  
  z <- 2
  if (!all(x$generation=="NA")) { 
    if (any(grepl("agamic",x$generation))){
      sub <- x[which(x$generation=="agamic"),]
      if (min(x$doy)>171){
        coef <- parcalc(sub,y,"seasind")
      } else {
        coef <- parcalc(sub,y,"acchours")  
      }
      agamlowslope <- coef[1,2]
      agamlowyint <- coef[1,1]
      agamhighslope <- coef[2,2]
      agamhighyint <- coef[2,1]
    } else {
      agamlowslope <- 0
      agamlowyint <- -9999
      agamhighslope <- 0
      agamhighyint <- -9999
    }
    
    
    if (any(grepl("sexgen",x$generation))){
      sub <- x[which(x$generation=="sexgen"),]
      if (min(x$doy)>171){
        coef <- parcalc(sub,y,"seasind")
      } else {
        coef <- parcalc(sub,y,"acchours")  
      }
      sglowslope <- coef[1,2]
      sglowyint <- coef[1,1]
      sghighslope <- coef[2,2]
      sghighyint <- coef[2,1]
    } else {
      sglowslope <- 0
      sglowyint <- -9999
      sghighslope <- 0
      sghighyint <- -9999
    }
    param <- as.data.frame(t(c(agamlowslope,agamlowyint,agamhighslope,agamhighyint,sglowslope,sglowyint,sghighslope,sghighyint)))
    colnames(param) <- c("agamlowslope","agamlowyint","agamhighslope","agamhighyint","sglowslope","sglowyint","sghighslope","sghighyint")
    
  } else {
    if (min(x$doy)>171){
      coef <- parcalc(x,y,"seasind")
    } else {
      coef <- parcalc(x,y,"acchours")
    }
    lowslope <- coef[1,2]
    lowyint <- coef[1,1]
    highslope <- coef[2,2]
    highyint <- coef[2,1]
    
    param <- as.data.frame(t(c(lowslope,lowyint,highslope,highyint)))
    colnames(param) <- c("lowslope","lowyint","highslope","highyint")
    
  }
  return(param)
}

doyLatAGDD50Eq <- function(x,y){ 
  x <- as.data.frame(x)
  if (all(is.na(x$gall_id))){
    x <- x[grepl('Flower Budding',x$phenophase),] 
  } else {
    x$phenostage <- paste0(x$phenophase, x$lifestage)
    x <- x[!x$phenophase=="senescent",]
    x <- x[!x$phenostage=="",]
    x <- x[!x$phenophase=="developing",]  
    x <- x[!x$phenophase=="dormant",] 
    x <- x[!x$phenophase=="oviscar",]
  }
  
  z <- 2
  if (!all(x$generation=="NA")) { 
    if (any(grepl("agamic",x$generation))){
      sub <- x[which(x$generation=="agamic"),]
      if (min(x$doy)>171){
        coef <- parcalc(sub,y,"percent50")
      } else {
        coef <- parcalc(sub,y,"AGDD50")  
      }
      agamlowslope <- coef[1,2]
      agamlowyint <- coef[1,1]
      agamhighslope <- coef[2,2]
      agamhighyint <- coef[2,1]
    } else {
      agamlowslope <- 0
      agamlowyint <- -9999
      agamhighslope <- 0
      agamhighyint <- -9999
    }
    
    
    if (any(grepl("sexgen",x$generation))){
      sub <- x[which(x$generation=="sexgen"),]
      if (min(x$doy)>171){
        coef <- parcalc(sub,y,"percent50")
      } else {
        coef <- parcalc(sub,y,"AGDD50")  
      }
      sglowslope <- coef[1,2]
      sglowyint <- coef[1,1]
      sghighslope <- coef[2,2]
      sghighyint <- coef[2,1]
    } else {
      sglowslope <- 0
      sglowyint <- -9999
      sghighslope <- 0
      sghighyint <- -9999
    }
    param <- as.data.frame(t(c(agamlowslope,agamlowyint,agamhighslope,agamhighyint,sglowslope,sglowyint,sghighslope,sghighyint)))
    colnames(param) <- c("agamlowslope","agamlowyint","agamhighslope","agamhighyint","sglowslope","sglowyint","sghighslope","sghighyint")
    
  } else {
    if (min(x$doy>171)){
      coef <- parcalc(x,y,"percent50")
    } else {
      coef <- parcalc(x,y,"AGDD50")
    }
    lowslope <- coef[1,2]
    lowyint <- coef[1,1]
    highslope <- coef[2,2]
    highyint <- coef[2,1]
    
    param <- as.data.frame(t(c(lowslope,lowyint,highslope,highyint)))
    colnames(param) <- c("lowslope","lowyint","highslope","highyint")
    
  }
  return(param)
}

doyLatAGDD32Eq <- function(x,y){ 
  x <- as.data.frame(x)
  if (all(is.na(x$gall_id))){
    x <- x[grepl('Flower Budding',x$phenophase),] 
  } else {
    x$phenostage <- paste0(x$phenophase, x$lifestage)
    x <- x[!x$phenophase=="senescent",]
    x <- x[!x$phenostage=="",]
    x <- x[!x$phenophase=="developing",]  
    x <- x[!x$phenophase=="dormant",] 
    x <- x[!x$phenophase=="oviscar",]
  }
  
  z <- 2
  if (!all(x$generation=="NA")) { 
    if (any(grepl("agamic",x$generation))){
      sub <- x[which(x$generation=="agamic"),]
      if (min(x$doy)>171){
        coef <- parcalc(sub,y,"percent32")
      } else {
        coef <- parcalc(sub,y,"AGDD32")  
      }
      agamlowslope <- coef[1,2]
      agamlowyint <- coef[1,1]
      agamhighslope <- coef[2,2]
      agamhighyint <- coef[2,1]
    } else {
      agamlowslope <- 0
      agamlowyint <- -9999
      agamhighslope <- 0
      agamhighyint <- -9999
    }
    
    
    if (any(grepl("sexgen",x$generation))){
      sub <- x[which(x$generation=="sexgen"),]
      if (min(x$doy)>171){
        coef <- parcalc(sub,y,"percent32")
      } else {
        coef <- parcalc(sub,y,"AGDD32")  
      }
      sglowslope <- coef[1,2]
      sglowyint <- coef[1,1]
      sghighslope <- coef[2,2]
      sghighyint <- coef[2,1]
    } else {
      sglowslope <- 0
      sglowyint <- -9999
      sghighslope <- 0
      sghighyint <- -9999
    }
    param <- as.data.frame(t(c(agamlowslope,agamlowyint,agamhighslope,agamhighyint,sglowslope,sglowyint,sghighslope,sghighyint)))
    colnames(param) <- c("agamlowslope","agamlowyint","agamhighslope","agamhighyint","sglowslope","sglowyint","sghighslope","sghighyint")
    
  } else {
    if (min(x$doy)>171){
      coef <- parcalc(x,y,"percent32")
    } else {
      coef <- parcalc(x,y,"AGDD32")
    }
    lowslope <- coef[1,2]
    lowyint <- coef[1,1]
    highslope <- coef[2,2]
    highyint <- coef[2,1]
    
    param <- as.data.frame(t(c(lowslope,lowyint,highslope,highyint)))
    colnames(param) <- c("lowslope","lowyint","highslope","highyint")
    
  }
  return(param)
}


# creates a new dataframe containing any maturing, adult, perimature observations outside the two lines calculated above
doyLatAnom <- function(x, y) {
  x <- as.data.frame(x)
  if (all(is.na(x$gall_id))){
    x <- x[grepl('Flower Budding',x$phenophase),] 
  } else {
    if (!isTRUE(all(is.na(x$lifestage)))){
      x$phenostage <- paste0(x$phenophase, x$lifestage)
    }
    x <- x[!x$phenophase=="senescent",]
    x <- x[!x$phenostage=="",]
    x <- x[!x$phenophase=="developing",]  
    x <- x[!x$phenophase=="dormant",] 
    x <- x[!x$phenophase=="oviscar",]
  }
  
  if (!isTRUE(all(is.na(x$generation)))) { 
    agam <- x[x$generation=="agamic",]
    if (isTRUE(y$agamlowslope[1]>0)){
      agamlow <- agam[(agam$latitude>y$agamlowslope[1]*agam$doy+y$agamlowyint[1]),]
    } else {
      agamlow <- agam[(agam$latitude<y$agamlowslope[1]*agam$doy+y$agamlowyint[1]),]
    }
    
    if (isTRUE(y$agamhighslope[1]>0)) {
      agamhigh <- agam[(agam$latitude<y$agamhighslope[1]*agam$doy+y$agamhighyint[1]),]
    } else {
      agamhigh <- agam[(agam$latitude>y$agamhighslope[1]*agam$doy+y$agamhighyint[1]),]
    }
    
    sg <- x[x$generation=="sexgen",]
    if (isTRUE(y$sglowslope[1]>0)) {
      sglow <- sg[(sg$latitude>y$sglowslope[1]*sg$doy+y$sglowyint[1]),]
    } else {
      sglow <- sg[(sg$latitude<y$sglowslope[1]*sg$doy+y$sglowyint[1]),]
    }
    
    if (isTRUE(y$sglowslope[1]>0)) {
      sghigh <- sg[(sg$latitude<y$sghighslope[1]*sg$doy+y$sghighyint[1]),]
    } else {
      sghigh <- sg[(sg$latitude>y$sghighslope[1]*sg$doy+y$sghighyint[1]),]
    }
    
    anom <- rbind(agamlow, agamhigh, sglow, sghigh)
    
  } else {
    
    if (isTRUE(y$lowslope[1]>0)) {
      low <- x[(x$latitude>y$lowslope[1]*x$doy+y$lowyint[1]),]
    } else {
      low <- x[(x$latitude<y$lowslope[1]*x$doy+y$lowyint[1]),]
    }
    
    if (isTRUE(y$highslope[1]>0)) {
      high <- x[(x$latitude<y$highslope[1]*x$doy+y$highyint[1]),]
    } else {
      high <- x[(x$latitude>y$highslope[1]*x$doy+y$highyint[1]),]
    }
    
    
    anom <- rbind(low, high)
    
  }
  if (dim(anom)[1]>50){
    warning("There are a lot of anomalous data points--check to make sure something didn't go wrong before browsing to them!")
  } 
  return(anom)
}

# creates a doy x latitude plot of all observations with the 2 sd lines calculated above
doyLatPlot <- function(x, y) {
  
  x <- as.data.frame(x)
  x$phenostage <- paste0(x$phenophase, x$lifestage)
  x <- x[!x$phenophase=="senescent",]
  # x <- x[grepl('Flower Budding',x$phenophase),]
  
  if (!all(x$generation=="NA")) { 
    p = ggplot(data = x, aes(x = doy, y = latitude, color=generation, shape=phenophase,size=22)) +
      geom_point()+
      geom_abline(intercept = y$agamlowyint[1], slope=y$agamlowslope[1], color="#E41A1C")+
      geom_abline(intercept = y$agamhighyint[1], slope=y$agamhighslope[1], color="#E41A1C")+
      geom_abline(intercept = y$sglowyint[1], slope=y$sglowslope[1], color="#008080")+
      geom_abline(intercept = y$sghighyint[1], slope=y$sghighslope[1], color="#008080")
    
  } else {
    p = ggplot(data = x, aes(x = doy, y = latitude, color=phenophase, shape=phenophase,size=22)) + 
      geom_point()+
      geom_abline(intercept = y$lowyint[1], slope=y$lowslope[1], color="#E41A1C")+
      geom_abline(intercept = y$highyint[1], slope=y$highslope[1], color="#E41A1C")
  }
  
  return(p)
}

# input a single observation ID (not URL or species code) to delete it from observations table and blacklist the id in baddata
markBad <- function(code) {
  library(DBI)
  gallphen <- dbConnect(RSQLite::SQLite(), "gallphen.sqlite")
  
  # is the obs code already in the baddata table?
  check <- dbGetQuery(gallphen, str_interp("SELECT 1 FROM baddata WHERE obs_id = '${code}'"))
  
  #if not, add it
  if (dim(check)[1]==0){
    codedf <- as.data.frame(code)
    colnames(codedf) <- "obs_id"
    dbAppendTable(gallphen, "baddata", codedf)
  }
  
  #do any observations have this obs ID in their URL?
  badurl <- paste0("www.inaturalist.org/observations/",code)
  check2 <- dbGetQuery(gallphen, str_interp("SELECT * FROM observations 
                                            WHERE pageURL LIKE '%${badurl}%'"))
  #if so, delete them all
  if (!dim(check2)[1]==0){
    count <- dbExecute(gallphen, str_interp("DELETE FROM observations 
          WHERE pageURL LIKE '%${badurl}%'"))
    return(paste("Number of observations deleted:", count))
  } else {
  return(paste("Number of observations deleted: 0"))
  }
}

# input an inat species code to set the date updated for that species to the current date
setUpdate <- function(code) {
  library(DBI)
  gallphen <- dbConnect(RSQLite::SQLite(), "gallphen.sqlite")
  date <- Sys.Date()
  count <- dbExecute(gallphen, str_interp("UPDATE specieshistory SET update_date = '${date}' WHERE species_id IN (SELECT species_id FROM species WHERE inatcode = '${code}')"))
  return(paste("Number of species update dates set to current date:", count))
}