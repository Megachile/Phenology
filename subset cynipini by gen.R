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
gfall <- dbConnect(RSQLite::SQLite(), "gallformers81723.sqlite")
tables <- dbListTables(gfall)
print(tables)
for (table in tables) {
  schema <- dbGetQuery(gfall, paste0("PRAGMA table_info(", table, ");"))
  print(schema)
}
dbGetQuery(gallphen, "SELECT * FROM species")
cynipidae <- dbGetQuery(gfall, "SELECT id FROM taxonomy WHERE name = 'Cynipidae'")
cyngen <- dbGetQuery(gfall, "SELECT id, name FROM taxonomy WHERE parent_id = 55 AND type = 'genus'")
cynispecies <- dbGetQuery(gfall, "
    SELECT species_id
    FROM speciestaxonomy
    WHERE taxonomy_id IN (SELECT id FROM taxonomy WHERE parent_id = 55 AND type = 'genus')
")

# Convert species IDs to a comma-separated string
id_string <- paste0(cynispecies$species_id, collapse = ",")

# Write the query using sprintf to substitute the id_string into the SQL code
query <- sprintf("
    SELECT *
    FROM species
    WHERE gf_id IN (%s)
", id_string)

# Execute the query
cynipid_species_details <- dbGetQuery(gallphen, query)
# List of genera to be removed
remove_genera <- c("Periclistus", "Diastrophus", "Diplolepis", "Liposthenes", 
                   "Antistrophus", "Phanacis", "Aulacidea", "Synergus")

# Drop rows not in cynipini
cynipini_species <- subset(cynipid_species_details, !(genus %in% remove_genera))

# Extract species that are in both generations
both_generations <- cynipini_species[cynipini_species$inatcode %in% 
                                       cynipini_species$inatcode[duplicated(cynipini_species$inatcode) | 
                                                                   duplicated(cynipini_species$inatcode, fromLast = TRUE)], ]

# Extract species that are only in the sexgen generation
only_sexgen <- setdiff(cynipini_species, both_generations)
only_sexgen <- subset(only_sexgen, generation == "sexgen")

# Extract species that are only in the agamic generation
only_agamic <- setdiff(cynipini_species, both_generations)
only_agamic <- subset(only_agamic, generation == "agamic")

# You can now go to Batch API Updates and add the right generations to all observations