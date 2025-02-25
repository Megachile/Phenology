library(DBI)
wd <- "C:/Users/adam/Documents/GitHub/Phenology"
setwd(wd)
allspecies_db <- dbConnect(RSQLite::SQLite(), "allspecies.sqlite")
dbListTables(allspecies_db)
dbListFields(allspecies_db, "Allspecies")

df <- dbGetQuery(allspecies_db, "SELECT * FROM Allspecies LIMIT 10;")
print(df)
library(dplyr)
library(tidyr)

# Load host_family data from the database
df_host <- dbGetQuery(allspecies_db, "
    SELECT host_family FROM Allspecies
    WHERE host_family IS NOT NULL AND host_family != '';
")

# Split the host_family column on commas, creating multiple rows per species
df_host <- df_host %>%
  mutate(host_family = strsplit(host_family, ",")) %>%
  unnest(host_family) %>%
  mutate(host_family = trimws(host_family))  # Remove extra spaces
df_family_counts <- df_host %>%
  count(host_family, name = "gall_count") %>%
  arrange(desc(gall_count))

# Print the top results
print(head(df_family_counts, 10))
ggplot(df_family_counts, aes(x = reorder(host_family, gall_count), y = gall_count)) +
  geom_col(fill = "steelblue") +
  coord_flip() +  # Flip for readability
  labs(
    x = "Host Plant Family",
    y = "Number of Associated Galls",
    title = "Number of Gall Species per Host Plant Family (Expanded)"
  ) +
  theme_minimal()

library(dplyr)

# Load the entire dataset into a dataframe
df_allspecies <- dbGetQuery(allspecies_db, "SELECT * FROM Allspecies;")

# Filter out rows where Relationship contains "Vagrant" (case insensitive)
df_inducers <- df_allspecies %>%
  filter(!grepl("Vagrant", Relationship, ignore.case = TRUE))

# Print summary
cat("Total rows after filtering:", nrow(df_inducers), "\n")

library(dplyr)
library(tidyr)
library(ggplot2)

# Step 1: Split host_family column and clean data
df_host <- df_inducers %>%
  select(host_family) %>%
  filter(!is.na(host_family)) %>%                     # Remove NAs
  mutate(host_family = strsplit(host_family, ",")) %>% # Split by comma
  unnest(host_family) %>%                              # Expand into separate rows
  mutate(host_family = trimws(host_family))            # Trim whitespace
df_family_counts <- df_host %>%
  count(host_family, name = "gall_count") %>%
  arrange(desc(gall_count))

# Print top 10 families for sanity check
print(head(df_family_counts, 10))
ggplot(df_family_counts, aes(x = reorder(host_family, gall_count), y = gall_count)) +
  geom_col(fill = "steelblue") +
  coord_flip() +  # Flip axes for better readability
  labs(
    x = "Host Plant Family",
    y = "Number of Associated Galls",
    title = "Number of Gall Species per Host Plant Family (Inducers Only)"
  ) +
  theme_minimal()

#nearctic

df_nearctic <- df_inducers %>%
  filter(grepl("Nearctic", regions, ignore.case = TRUE))

# Print how many rows remain after filtering
cat("Total Nearctic gall-inducing species:", nrow(df_nearctic), "\n")
df_host_nearctic <- df_nearctic %>%
  select(host_family) %>%
  filter(!is.na(host_family)) %>%
  mutate(host_family = strsplit(host_family, ",")) %>%
  unnest(host_family) %>%
  mutate(host_family = trimws(host_family))  # Trim whitespace
df_family_counts_nearctic <- df_host_nearctic %>%
  count(host_family, name = "gall_count") %>%
  arrange(desc(gall_count))

# Print top 10 families for sanity check
print(head(df_family_counts_nearctic, 10))
ggplot(df_family_counts_nearctic, aes(x = reorder(host_family, gall_count), y = gall_count)) +
  geom_col(fill = "steelblue") +
  coord_flip() +
  labs(
    x = "Host Plant Family",
    y = "Number of Associated Galls",
    title = "Number of Gall Species per Host Plant Family (Nearctic Inducers Only)"
  ) +
  theme_minimal()


#compare to GF db

gfall_db <- dbConnect(RSQLite::SQLite(), "gallformers122223.sqlite")
# Reconnect to gfall.sqlite
gfall_db <- dbConnect(SQLite(), "gallformers.sqlite")

# Extract gall species names from Eriophyidae, removing parentheticals
query_eriophyidae <- "
WITH UniqueGallNames AS (
    SELECT DISTINCT 
        LOWER(TRIM(
            CASE 
                WHEN instr(s.name, '(') > 0 
                THEN substr(s.name, 1, instr(s.name, '(') - 1)  
                ELSE s.name 
            END
        )) AS base_name
    FROM gallspecies gs
    JOIN species s ON gs.species_id = s.id
    JOIN speciestaxonomy st ON s.id = st.species_id
    JOIN taxonomy t1 ON st.taxonomy_id = t1.id  -- Get genus
    JOIN taxonomy t2 ON t1.parent_id = t2.id    -- Get family
    WHERE t1.type = 'genus' AND t2.name = 'Eriophyidae'
)
SELECT base_name FROM UniqueGallNames;
"

# Fetch the list
df_gfall_eriophyidae <- dbGetQuery(gfall_db, query_eriophyidae)

# Convert to a vector of species names
gfall_species_list <- tolower(df_gfall_eriophyidae$base_name)

# Print preview
print(head(gfall_species_list, 10))

df_nearctic_processed <- df_nearctic %>%
  mutate(
    species_cleaned = sub(" .*", "", species),  # Keep only first word of species name
    full_species = tolower(paste(genus, species_cleaned))  # Combine genus + species
  )

# Print preview
print(head(df_nearctic_processed$full_species, 10))

df_missing_species <- df_nearctic_processed %>%
  filter(!(full_species %in% gfall_species_list))

# Print results
print(df_missing_species)

df_missing_species_filtered <- df_missing_species %>%
  filter(
    !grepl("no damage", Relationship, ignore.case = TRUE) & 
      !grepl("rust", Relationship, ignore.case = TRUE)
  )

# Print results
print(df_missing_species_filtered)

