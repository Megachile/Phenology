library(DBI)
library(dbx)
library(tidyr)
library(sjmisc)
library(RSQLite)
library(rinat)
library(stringr)
library(ggplot2)
library(lubridate)
wd <- "C:/Users/adam/Documents/GitHub/Phenology"
setwd(wd)
gallphen <- dbConnect(RSQLite::SQLite(), "gallphenReset.sqlite")
gfall <- dbConnect(RSQLite::SQLite(), "gallformers.sqlite")
dbDisconnect(gallphen)
dbDisconnect(gfall)

dbListTables(gallphen)
dbListFields(gfall, "gallspecies")
dbListFields(gfall, "gall")
dbListFields(gallphen, "species")
dbReadTable(gfall, "species")
# dbGetQuery(gfall, "SELECT * FROM gall ORDER BY undescribed DESC LIMIT 10")
# taxa <- dbGetQuery(gfall, "SELECT id, taxoncode, name FROM species")
# taxa <- dbGetQuery(gfall, "SELECT * FROM species
#                    LEFT JOIN gallspecies ON gallspecies.species_id = species.id
#                    LEFT JOIN gall ON gall.id = gallspecies.gall_id
#                    ")
# colnames(taxa)[1:2] <- c("gf_id","type")
# taxa <- separate(taxa, name, into=c("genus","species"), sep = " ", remove=FALSE,extra = "merge")
# 
# for (i in 1:dim(taxa)[1]){
#   if (str_contains(taxa$species[i], 'agamic')){
#     taxa$generation[i] <- "agamic"
#   } else if (str_contains(taxa$species[i], 'sexgen')) {
#     taxa$generation[i] <- "sexgen"
#   } else {
#     taxa$generation[i] <- "NA"
#   }
# }
# taxa[6:12] <- list(NULL)

# dbWriteTable(gallphen, "species", taxa, append=TRUE)
dbGetQuery(gallphen, "SELECT * FROM species LIMIT 15")

# dbExecute(gallphen, "
# CREATE TABLE species
# (
#   species_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
#   gf_id INTEGER,
#   genus TEXT,
#   species TEXT,
#   inatcode INTEGER
# )")

# dbExecute(gallphen, "
# CREATE TABLE galls
# (
#   gall_id INTEGER NOT NULL,
#   generation TEXT CHECK (generation IN ('Agamic','Sexgen','NA')),
#   described INTEGER CHECK (described IN (0,1)),
#   FOREIGN KEY(gall_id) REFERENCES species(species_id)
# )")

# dbExecute(gallphen, "
# CREATE TABLE species
# (
#   species_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
#   gf_id INTEGER,
#   genus TEXT,
#   species TEXT,
#   inatcode INTEGER,
#   type TEXT CHECK (type IN ('gall','plant')),
#   generation TEXT CHECK (generation IN ('agamic','sexgen','NA')),
#   undescribed INTEGER CHECK (undescribed IN (0,1))
# )")
# 
# 
# dbExecute(gallphen, "
# CREATE TABLE observations
# (
#   obs_id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
#   gall_id INTEGER,
#   host_id INTEGER,
#   sourceURL TEXT,
#   pageURL TEXT,
#   phenophase TEXT NOT NULL,
#   lifestage TEXT,
#   viability TEXT,
#   date TEXT,
#   doy INTEGER,
#   latitude FLOAT NOT NULL,
#   longitude FLOAT NOT NULL,
#   site TEXT,
#   state TEXT,
#   country TEXT,
#   AGDD32 FLOAT,
#   AGDD50 FLOAT,
#   yearend32 FLOAT,
#   yearend50 FLOAT,
#   percent32 FLOAT,
#   percent50 FLOAT,
#   FOREIGN KEY(gall_id) REFERENCES galls(species_id),
#   FOREIGN KEY(host_id) REFERENCES species(species_id)
# )")

# dbExecute(gallphen, "
# CREATE table specieshistory (
#   species_id INTEGER NOT NULL,
#   update_date TEXT NOT NULL,
#   FOREIGN KEY(species_id) REFERENCES species(species_id)
# )")
# 
# dbExecute(gallphen, "
# CREATE table baddata (
#   obs_id INTEGER NOT NULL
#   )")

dbListTables(gallphen)
# dbExecute(gallphen, "DROP TABLE specieshistory")
# dbExecute(gallphen, "DROP TABLE species")
# dbExecute(gallphen, "DROP TABLE baddate")
# dbExecute(gallphen, "DROP TABLE observations")

# dbExecute(gallphen, "
# CREATE table inatcodes (
# id INTEGER NOT NULL,
# genus TEXT,
# scientificName TEXT,
# specificEpithet TEXT,
# taxonRank TEXT NOT NULL
#   )")
# import inat code and taxonomy from iNat
# taxa <- read.csv(paste0(wd, "/taxa.csv"))
# taxa <- taxa[,c("id","genus","scientificName","specificEpithet","taxonRank")]
# dbAppendTable(gallphen, "inatcodes",taxa)


# dbExecute(gallphen, "
# CREATE table commonnames (
#   id INTEGER NOT NULL,
#   vernacularName TEXT NOT NULL,
#   FOREIGN KEY(id) REFERENCES inatcodes(id)
#   )")

# import common name sheet from iNat
# VN <- read.csv(paste0(wd, "/VN-english.csv"))
# VN <- VN[,1:2]
# 
# dbAppendTable(gallphen, "commonnames",VN)

# use iNat data to fill in iNat codes of every species in the species table
dbExecute(gallphen, "UPDATE species SET inatcode = inatcodes.id
FROM inatcodes
WHERE species.genus = inatcodes.genus AND species.species LIKE '%' || inatcodes.specificEpithet || '%' AND inatcodes.specificEpithet != '' AND taxonRank != 'variety' AND taxonRank != 'hybrid' AND taxonRank != 'subspecies' ")


dbGetQuery(gallphen,"SELECT * FROM species WHERE species_id = '1362'")
dbGetQuery(gallphen,"SELECT * FROM species WHERE genus = 'Callirhytis' AND species LIKE '%soperat%'")


sen <- input[which(input$phenophase=="dormant"&input$doy>20&input$doy<60),]
query <- paste0("WHERE obs_id IN (", paste(sprintf("'%s'",sen$obs_id), collapse = ","),")")
query <- paste0("WHERE obs_id = '15328'")

select <- paste0("SELECT * FROM observations ", query)
dbGetQuery(gallphen, select)
# update <- paste0("UPDATE observations SET phenophase = ''", query)
# dbExecute(gallphen, update)
 # delete <- paste0("DELETE FROM observations ", query)
 # dbExecute(gallphen, delete)





# quercus <- quercus[is.na(quercus$inatcode),]

dbGetQuery(gallphen, "SELECT DISTINCT taxonRank FROM inatcodes")

dbGetQuery(gallphen, "SELECT DISTINCT country FROM observations ORDER BY obs_id DESC LIMIT 7")
# dbExecute(gallphen, "UPDATE observations SET phenophase = 'dormant' WHERE phenophase = 'maturing' AND pageURL = 'https://www.biodiversitylibrary.org/page/7610635#page/279/mode/1up'")


# fix dates added as Julian dates
# for (i in 1:22159) {
#   date <- dbGetQuery(gallphen, str_interp("SELECT date FROM observations WHERE obs_id = '${i}'"))
# 
#   if (!grepl("-", date)){
#    chrdate <- as.character(as.Date(as.numeric(date), origin = as.Date("1970-01-01")))
#    dbExecute(gallphen, str_interp("UPDATE observations SET date = '${chrdate}' WHERE obs_id = '${i}'"))
#   }
# }


# Add lifestage Adult to maturing gall observations that are missing it
# blank <-dbGetQuery(gallphen, "SELECT * FROM observations WHERE phenophase = 'maturing' AND lifestage IS NULL")
# 
# dbExecute(gallphen, "UPDATE observations SET lifestage = 'Adult'
# WHERE phenophase = 'maturing' AND lifestage IS NULL ")

# add a single new species to the db manually
# dbExecute(gallphen, "INSERT INTO species (gf_id,genus,species,type,undescribed) VALUES ('4689','Unknown','q-imbricaria-bent-catkin','gall','1')")


# 
# 
# lit <- read.csv(paste0(wd, "/litdates.csv"))
# 
# dbWriteTable(gallphen, "observations", obsbackup)
# littable <-dbGetQuery(gallphen, "SELECT * FROM observations")
# write.csv(littable, paste0(wd, "obsbackup.csv"), row.names = FALSE)
# 
# # ids <- dbGetQuery(gallphen,"SELECT species_id FROM species")
# # ids$update_date <- "never"
# # dbAppendTable(gallphen,"specieshistory",ids)

dbGetQuery(gallphen, "PRAGMA integrity_check")
dbGetQuery(gallphen, "PRAGMA foreign_key_check")
dbConnect(gallphen)
