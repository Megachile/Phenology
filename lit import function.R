



data <- dbGetQuery(gallphen, "SELECT * FROM observations 
                             WHERE sourceURL = 'https://www.gallformers.org/source/9'")

#import file
fnsites <- read.csv(paste0(wd,"/fnsites.csv"))
lit <- read.csv(paste0(wd,"/litdates6.csv"))
lit <- lit[!is.na(lit$gall_id),]

#remove duplicates (K decidua, K rileyi, X q forticorne, D q flocci)
lit <- lit[!(lit$gf_id==c("577","735","851","865","764","1340","1317","1339")),]

# use GF_id to fill gall_id
for (i in 1:dim(lit)[1]){
lit$gall_id[i] <- dbGetQuery(gallphen, str_interp("SELECT species_id FROM species
                                                      WHERE gf_id = '${lit$gf_id[i]}'"))
}
# use host_species to fill host_id
for (i in 1:dim(lit)[1]){
lit$host_id[i] <- dbGetQuery(gallphen, str_interp("SELECT species_id FROM species
                                                      WHERE inatcode = (SELECT id FROM commonnames WHERE vernacularName LIKE '%${lit$host_species[i]}%')"))
}

# convert XXXX- dates to doy and delete
for (i in 1:dim(lit)[1]){
  if (grepl(xxxx,lit$date[i],ignore.case = TRUE)){
    lit$date[i] <- gsub(xxxx,'2021',lit$date[i], ignore.case = TRUE)
    lit$doy[i] <- yday(lit$date[i])
    lit$date[i] <- NA
  } else {
        lit$doy[i] <- yday(lit$date[i])
      }
    
  }

# use site to fill in lat/long state and country
merge(lit, fnsites)

# delete GF_id and host_species
lit$gf_id <- NULL
lit$host_species <- NULL

#append to table
# dbAppendTable(gallphen, "observations",lit)
