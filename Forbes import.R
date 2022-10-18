library(readxl)

CAsheet <- multiplesheets(paste0(wd,"/CAgalls.xlsx"))
CAsites <- read.csv(paste0(wd,"/CAsites.csv"))
CArecords <- read.csv(paste0(wd,"/CArecords.csv"))



sites <- read.csv(paste0(wd,"/ForbesENAsites.csv"))
key <- read.csv(paste0(wd,"/ForbesENAspecies.csv"))
collections <- read.csv(paste0(wd,"/ForbesENAcollections.csv"))
data <- read.csv(paste0(wd,"/ForbesENAdata.csv"))


# use GF_id to fill gall_id
for (i in 1:dim(key)[1]){
  key$gall_id[i] <- dbGetQuery(gallphen, str_interp("SELECT species_id FROM species
                                                      WHERE gf_id = '${key$gf_id[i]}'"))
}

#convert new ID columns back to vectors
key$gall_id <- unlist(key$gall_id)
key <- key[,-c(2,3,4)]
str(key)

records <- collections

# use host_species to fill host_id
for (i in 1:dim(records)[1]){
  records$host_id[i] <- dbGetQuery(gallphen, str_interp("SELECT species_id FROM species
                                                      WHERE genus = '${records$genus[i]}' AND species LIKE '%${records$species[i]}%'"))
}

records[111,13] <- NA
records$host_id <- unlist(records$host_id)

records$code <- str_pad(records$code, 3, pad = "0")

records <- merge(records,key, by="code",all.x=TRUE)

records <- records[,-c(3,4,5,7,8,9,10,11,12)]
records <- records[,-2]
data$date <- gsub("/","-",data$date)
data$date <- as.Date(data$date, tryFormats = "%m-%d-%Y")

# records <- merge(records, key, by=c("code","collection"))
records <- merge(records, sites, by="SiteTemp")
records$gall_id <- unlist(records$gall_id)
str(records)
records <- records[,-1]

data <- merge(data, records, by="collection",all.x=TRUE)
data <- merge(data, key, by="code",all.x=TRUE)


data$sourceURL <- "https://www.biorxiv.org/content/10.1101/2022.02.11.480154v1.abstract"
data$pageURL <- NA
data$doy <- yday(data$date)
data$code <- NULL
data$collection <- NULL
data$AGDD32 <- NA
data$AGDD50 <- NA
data$yearend32 <- NA
data$yearend50 <- NA
data$percent32 <- NA
data$percent50 <- NA
# dbAppendTable(gallphen, "observations",data)

# dbGetQuery(gallphen, "SELECT species_id FROM species WHERE genus = 'Quercus' AND species = 'alba'")

