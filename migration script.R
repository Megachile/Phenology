library(tidyr)
library(sjmisc)
wd <- "C:/Users/adam/Documents/GitHub/Phenology"
setwd(wd)
gallphen <- dbConnect(RSQLite::SQLite(), "gallphenReset.sqlite")
gfall <- dbConnect(RSQLite::SQLite(), "gallformersNew.sqlite")

taxa <- dbGetQuery(gfall, "SELECT id, taxoncode, name FROM species")
taxa <- dbGetQuery(gfall, "SELECT * FROM species
                   LEFT JOIN gallspecies ON gallspecies.species_id = species.id
                   LEFT JOIN gall ON gall.id = gallspecies.gall_id
                   ")
colnames(taxa)[1:2] <- c("gf_id","type")
taxa <- separate(taxa, name, into=c("genus","species"), sep = " ", remove=FALSE,extra = "merge")

for (i in 1:dim(taxa)[1]){
  if (str_contains(taxa$species[i], 'agamic')){
    taxa$generation[i] <- "agamic"
  } else if (str_contains(taxa$species[i], 'sexgen')) {
    taxa$generation[i] <- "sexgen"
  } else {
    taxa$generation[i] <- NA
  }
}

#checking for deleted entries and added entries
gallphen_data <- dbGetQuery(gallphen, "SELECT * FROM species")
gf_ids_gallphen_data <- subset(gallphen_data, select = c("gf_id"))
gf_ids_taxa <- subset(taxa, select = c("gf_id"))

gf_ids_only_in_gallphen_data <- setdiff(gf_ids_gallphen_data, gf_ids_taxa)
gf_ids_only_in_taxa <- setdiff(gf_ids_taxa, gf_ids_gallphen_data)

deleted <- subset(gallphen_data, gf_id %in% gf_ids_only_in_gallphen_data$gf_id)
new <- subset(taxa, gf_id %in% gf_ids_only_in_taxa$gf_id)

#check to see if any of the taxa deleted on gf had observations in the pheno db; if this is empty, the deleted entries can be ignored!
observations <- NULL
for (i in 1:dim(deleted)[1]){
  query <- paste0("SELECT * FROM observations WHERE gall_id in (SELECT species_id FROM species WHERE gf_id ='", deleted$gf_id[i], "')")
  if (is.null("observations")){
    observations <- dbGetQuery(gallphen, query)
  } else {
    observations <- rbind(observations, dbGetQuery(gallphen, query))
  }
}
if (dim(observations)[1]>0){
  warning("Sorry, it's time to manually update some references! :<")
} else {
  warning("Looks like you don't have to worry about manual updates this time! :)")
}

#TBD tools to help manually update references would go here

#To append new taxa to the gallphen db
new$inatcode <- NA
new <- new %>% select(-name, -datacomplete, -abundance_id, -species_id, -gall_id, -id, -taxoncode, -detachable)
# dbWriteTable(gallphen, "species", new, append=TRUE)

# # use iNat data to fill in iNat codes of every species in the species table
# dbExecute(gallphen, "UPDATE species SET inatcode = inatcodes.id
# FROM inatcodes
# WHERE species.inatcode IS NULL AND species.genus = inatcodes.genus AND species.species LIKE '%' || inatcodes.specificEpithet || '%' AND inatcodes.specificEpithet != '' AND taxonRank != 'variety' AND taxonRank != 'hybrid' AND taxonRank != 'subspecies' ")

#check existing taxa for changes
exist <- anti_join(taxa, semi_join(taxa,new, by = "gf_id"), by = "gf_id")
exist <- exist %>% select(-name, -datacomplete, -abundance_id, -species_id, -gall_id, -id, -taxoncode, -detachable)

gallphen_data_filt <- anti_join(gallphen_data,deleted, by = "gf_id")
gallphen_data_filt <- gallphen_data_filt %>% select(-species_id, -inatcode)

gallphen_data_filt$row_num <- 1:nrow(gallphen_data_filt)
exist$row_num <- 1:nrow(exist)
merged_data <- merge(gallphen_data_filt, exist, by = c("gf_id", "row_num"))
merged_data[is.na(merged_data)] <- "NA"

#find genus updates
diffs <- NA
for (i in 1:dim(merged_data)[1]){
  diffs[i] <- identical(merged_data[i,"genus.x"], merged_data[i,"genus.y"])
}
which(diffs=="FALSE")
genus <- merged_data[which(diffs=="FALSE"),]

#update the genus
for (i in 1:dim(genus)[1]){
  query <- paste0("UPDATE species SET genus = '", genus[i,"genus.y"], "' WHERE gf_id = '", genus[i,"gf_id"], "'")
  dbExecute(gallphen, query)
}
#check to see if it worked
for (i in 1:dim(genus)[1]){
     query <- paste0("SELECT * FROM species WHERE gf_id = '", genus[i,"gf_id"], "'")
     print(dbGetQuery(gallphen, query))
  }

#find generation updates
diffs <- NA
for (i in 1:dim(merged_data)[1]){
  diffs[i] <- identical(merged_data[i,"generation.x"], merged_data[i,"generation.y"])
}
which(diffs=="FALSE")
generation <- merged_data[which(diffs=="FALSE"),]

#update the generation
for (i in 1:dim(generation)[1]){
  query <- paste0("UPDATE species SET generation = '", generation[i,"generation.y"], "' WHERE gf_id = '", generation[i,"gf_id"], "'")
  dbExecute(gallphen, query)
}
#check to see if it worked
for (i in 1:dim(generation)[1]){
  query <- paste0("SELECT * FROM species WHERE gf_id = '", generation[i,"gf_id"], "'")
  print(dbGetQuery(gallphen, query))
}

#find species updates
diffs <- NA
for (i in 1:dim(merged_data)[1]){
  diffs[i] <- identical(merged_data[i,"species.x"], merged_data[i,"species.y"])
}
which(diffs=="FALSE")
species <- merged_data[which(diffs=="FALSE"),]

#update the species
for (i in 1:dim(species)[1]){
  query <- paste0("UPDATE species SET species = '", species[i,"species.y"], "' WHERE gf_id = '", species[i,"gf_id"], "'")
  dbExecute(gallphen, query)
}
#check to see if it worked
for (i in 1:dim(species)[1]){
  query <- paste0("SELECT * FROM species WHERE gf_id = '", species[i,"gf_id"], "'")
  print(dbGetQuery(gallphen, query))
}

#find type updates
diffs <- NA
for (i in 1:dim(merged_data)[1]){
  diffs[i] <- identical(merged_data[i,"type.x"], merged_data[i,"type.y"])
}
which(diffs=="FALSE")
type <- merged_data[which(diffs=="FALSE"),]

#update the type
for (i in 1:dim(type)[1]){
  query <- paste0("UPDATE species SET type = '", type[i,"type.y"], "' WHERE gf_id = '", type[i,"gf_id"], "'")
  dbExecute(gallphen, query)
}
#check to see if it worked
for (i in 1:dim(type)[1]){
  query <- paste0("SELECT * FROM species WHERE gf_id = '", type[i,"gf_id"], "'")
  print(dbGetQuery(gallphen, query))
}

#find undescribed updates
diffs <- NA
for (i in 1:dim(merged_data)[1]){
  diffs[i] <- identical(merged_data[i,"undescribed.x"], merged_data[i,"undescribed.y"])
}
which(diffs=="FALSE")
undescribed <- merged_data[which(diffs=="FALSE"),]

#update the undescribed
for (i in 1:dim(undescribed)[1]){
  query <- paste0("UPDATE species SET undescribed = '", undescribed[i,"undescribed.y"], "' WHERE gf_id = '", undescribed[i,"gf_id"], "'")
  dbExecute(gallphen, query)
}
#check to see if it worked
for (i in 1:dim(undescribed)[1]){
  query <- paste0("SELECT * FROM species WHERE gf_id = '", undescribed[i,"gf_id"], "'")
  print(dbGetQuery(gallphen, query))
}

