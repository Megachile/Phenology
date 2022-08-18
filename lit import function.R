



data <- dbGetQuery(gallphen, "SELECT * FROM observations 
                             WHERE sourceURL = 'https://www.gallformers.org/source/9'")

#import file
lit <- read.csv(paste0(wd,"/litdates6.csv"))
lit <- lit[!is.na(lit$gall_id),]


# use GF_id to fill gall_id


# use host_species to fill host_id

# convert XXXX- dates to doy and delete

for (i in 1:dim(lit)[1]){
  if (is.na(lit$doy[i])){
    lit$doy[i] <- yday(lit$date[i])
  }}

# use site to fill in lat/long state and country

# delete GF_id and host_species

#remove duplicates (K decidua, K rileyi, X q forticorne, D q flocci)

#append to table

#add to the database
dbAppendTable(gallphen, "observations",lit)


lit <- seasonIndex(lit)
lit <- acchours(lit)

data <- rbind(lit, data)

unique(names(lit),names(data))
