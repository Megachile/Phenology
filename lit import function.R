# library(tidygeocoder)
library(DBI)
# data <- dbGetQuery(gallphen, "SELECT * FROM observations WHERE sourceURL = 'https://www.gallformers.org/source/9'")

#import file
# fnsites <- read.csv(paste0(wd,"/FNsites.csv"))
# fnsites <- fnsites[,1:5]
wd <- "C:/Users/adam/Documents/GitHub/Phenology"
setwd(wd)
gallphen <- dbConnect(RSQLite::SQLite(), "gallphenReset.sqlite")
lit <- read.csv(paste0(wd,"/litdates9.csv"))
lit <- lit[!is.na(lit$gf_id),]

#remove duplicates (K decidua, K rileyi, X q forticorne, D q flocci)
# lit <- lit[!(lit$gf_id=="577"|lit$gf_id=="735"|lit$gf_id=="851"|lit$gf_id=="865"|lit$gf_id=="764"|lit$gf_id=="1340"|lit$gf_id=="1317"|lit$gf_id=="1339"),]

# use GF_id to fill gall_id
for (i in 1:dim(lit)[1]){
lit$gall_id[i] <- dbGetQuery(gallphen, str_interp("SELECT species_id FROM species
                                                      WHERE gf_id = '${lit$gf_id[i]}'"))
}

lit <- lit[lit$gall_id != "integer(0)", ]

# use host_species to fill host_id
for (i in 1:dim(lit)[1]){
lit$host_id[i] <- dbGetQuery(gallphen, str_interp("SELECT species_id FROM species
                                                      WHERE genus = '${lit$genus[i]}' AND species LIKE '%${lit$species[i]}%'"))
}

# lit$doy <- yday(lit$date)

lit[lit$host_id=="integer(0)",5] <- NA

#convert new ID columns back to vectors
lit$gall_id <- unlist(lit$gall_id)
lit$host_id <- unlist(lit$host_id)

# convert XXXX- dates to doy and delete
for (i in 1:dim(lit)[1]){
  if (grepl('xxxx', lit$date[i], ignore.case = TRUE)) {
    lit$date[i] <- gsub('xxxx', '2021', lit$date[i], ignore.case = TRUE)
    lit$doy[i] <- yday(lit$date[i])
    lit$date[i] <- NA
  } else {
    date_string <- lit$date[i]
    if (grepl("/", date_string)) {
      date_object <- strptime(date_string, "%m/%d/%Y")
      lit$date[i] <- as.character(date_object, format = "%Y-%m-%d")
    }
    lit$doy[i] <- yday(lit$date[i])
  }
}

# site <- unique(lit$site)
# sites <- data.frame(matrix(ncol = 4, nrow =178))
# colnames(sites) <- c('latitude','longitude','state','country')
# sites <- cbind(site,sites)
# write.csv(sites,paste0(wd,"/sitesblank.csv"))
# 
# fnlatlong <- geocode(fnsites, city=site, state=state,country=country)
# write.csv(fnlatlong,paste0(wd,"/sitesfilled.csv"))

# use site to fill in lat/long state and country
# setdiff(unique(lit$site), unique(fnsites$site))
# lit <- lit[,!(names(lit) %in% c("latitude","longitude","state","country"))]
# lit <- merge(lit, fnsites, by = "site",all.x=TRUE)
lit <- lit[,!(names(lit) %in% c("gf_id","genus","species"))]

#append to table
# dbAppendTable(gallphen, "observations",lit)
