library(DBI)
library(dbx)
library(tidyr)
library(sjmisc)
library(RSQLite)
library(rinat)
library(stringr)
library(ggplot2)
library(jsonlite)
library(compare)
library(data.table)
library(tidyr)
library(lubridate)
library(dplyr)
library(plyr)
library(ddpcr)
library(rnpn)
library(ggplot2)
library(ggpmisc)
library(solrad)
library(pracma)
library(stringr)
wd <- "C:/Users/adam/Documents/GitHub/Phenology"
setwd(wd)
source("iNatImportFunctions.R")
gallphen <- dbConnect(RSQLite::SQLite(), "gallphenReset.sqlite")
eas <- read.csv(paste0(wd, "/phenogrid.csv" ))
ann <- get_annotation_codes()

## input iNat code or GF code for a taxon you want to pull data for
spcode <- "1094748"

#generate an API call URL for that code, after last fetched date for that code
url <- urlMaker(spcode)

## limit to only observations with plant phenology (for plant observations only)
# url <- paste0(url, "&term_id=12")

## create an API call for observations from a specific user (current settings get RG of any cynipini observations)
url <- "https://api.inaturalist.org/v1/observations?quality_grade=research&user_id=leah_r&identifications=any&page=1&place_id=6712%2C1&per_page=200&order=desc&order_by=created_at&taxon_id=205775"

## iNat API call to pull a dataframe of all matching observations. This iterates in batches of 200 at a time. 
obs <- iNatCall(url)
#Once you fetch this, check the dataframe for species you don't expect, missing data, etc

## removes any observations that aren't ID'd exactly to species; this may or may not be desirable depending on your context
# obs <- obs %>% filter(nchar(obs$taxon.name) - nchar(gsub(" ", "", obs$taxon.name)) + 1 == 2)

## remove any observations missing date and observations that are marked senescent
obs <- obs[!(obs$observed_on==""),]
obs <- obs[!(obs$Gall_phenophase=="senescent"),]

# remove any rows with IDs in the baddata table or already present in the observations table. Eliminates any records that are not new. 
# only works for iNat inputs, do not run on other data!
new <- checkData(obs)

#check for observations that may have mislabeled annotations. Larva and pupa are plausible but need to be verified; egg is almost always spurious
mislabeled <- new[new$Life_Stage=='Larva'|new$Life_Stage=='Pupa'|new$Life_Stage=='Egg',]
#open each in your default browser, in batches of 20
for (i in 1:20){
  browseURL(mislabeled$uri[i])
}

# some code to help manually correct issues that can't be fixed or it isn't convenient to fix on the iNat side. 
# inat observation ID of a problematic record
prob <- "156651973"

# new <- new[new$id != prob, ]
# new[new$id==prob,"Life_Stage"] <- NA
# new[new$id==prob,"Gall_phenophase"] <- "dormant"
# new[new$id==prob,"Gall_generation"] <- "bisexual"
# new[new$id==prob,"Host_Plant_ID"] <- "49006"
# new[new$uri==prob,"taxon.name"] <- "Phylloteras poculum"
# new <- new[!(new$taxon.name == 'Phylloteras poculum'), ]



# creates a *new* dataframe with only rows missing some key data
missing <- findMissing(new)
print(dim(missing)[1])
#open each in your default browser, in batches of 20
for (i in 1:20){
  browseURL(missing$uri[i])
}

# drop rows that are missing key info (these are often not usable yet for a variety of reasons)
# new = new[!(new$id %in% missing$id), ]
# drop rows specifically missing gall generation
# new <- new[!(new$Gall_generation==""),]

# append[append$pageURL=="https://www.inaturalist.org/observations/110335394","lifestage"] <- NA

# Theoretically, this checks to make sure all of the host ID codes in the data you just pulled are already in our database; this function may not be working correctly though
# checkHost(new)

# In case you need to add a new host to the database (also works for galls fwiw)
# dbExecute(gallphen, "UPDATE species SET inatcode = '242521'
#            WHERE genus = 'Quercus' AND species = 'sinuata breviloba'")

# In case you want to just print the new records and edit them manually in a csv (then you can use the lit import function to add them to the db)
# write.csv(new, file = "newrecords.csv", row.names = FALSE)

#remove and add columns to match database table
toappend <- new

toappend <- clean_and_transform(toappend)
toappend <- separate_taxon_name(toappend)

# WARNING note that as currently written, these assign host and assign gall functions will drop any rows where the 
# gall ID is not in the current local version of the database 
# and where multiple gall IDs are not disambiguated (ie, N quercusbatatus) 
# the functions are fairly conservative and if you give them something confusing they will just toss the data. 
# Pay attention to the outputs to look for any anomalies!

toappend <- assign_host_id_verbose(toappend, gallphen)
toappend <- assign_gall_id_verbose(toappend, gallphen)
toappend <- assign_phenophase(toappend)
toappend <- seasonIndex(toappend)
toappend <- acchours(toappend)

#specify an observation with some issue based on its URL
# prob <- "https://www.inaturalist.org/observations/15884207"
# fix problematic value
# append[append$pageURL==prob,"lifestage"] <- NA

#add to the database
# dbAppendTable(gallphen, "observations",toappend)

# if this is a specific species, update the last updated date to the current date to adjust the URL to only pull new observations next time you pull data
# this is not necessary--if you don't do it and try to re-add the same observations, they will get filtered out by checkData above
# setUpdate(spcode)

# enter an iNat observation ID (not a species ID!) to put it into the baddata table so it will be excluded from future imports. 
# also deletes any records with that code in the observations table
# checks to see if code is already present first so in theory it can safely be run multiple times on the same code
# markBad()
