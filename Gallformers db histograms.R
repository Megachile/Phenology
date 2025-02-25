library(DBI)
wd <- "C:/Users/adam/Documents/GitHub/Phenology"
setwd(wd)
gfall <- dbConnect(RSQLite::SQLite(), "gallformers122223.sqlite")

tables <- dbListTables(gfall)
for (table in tables) {
  cat("\nTable:", table, "\n")
  print(dbGetQuery(gfall, paste("PRAGMA table_info(", table, ");")))
}
# Get index info for all tables
for (table in tables) {
  cat("\nIndexes for table:", table, "\n")
  print(dbGetQuery(gfall, paste("PRAGMA index_list(", table, ");")))
}

# Get foreign key info for all tables
for (table in tables) {
  cat("\nForeign keys for table:", table, "\n")
  print(dbGetQuery(gfall, paste("PRAGMA foreign_key_list(", table, ");")))
}

query <- "
SELECT t.name AS family, COUNT(DISTINCT gs.gall_id) AS gall_count
FROM gallspecies gs
JOIN host h ON gs.species_id = h.gall_species_id  -- Link galls to their host species
JOIN species s ON h.host_species_id = s.id  -- Get host species details
JOIN speciestaxonomy st ON s.id = st.species_id  -- Link host species to taxonomy
JOIN taxonomy t ON st.taxonomy_id = t.id  -- Get taxonomy information (family level)
WHERE t.type = 'family'
GROUP BY t.name
ORDER BY gall_count DESC;
"

# Run the query and store the results
df <- dbGetQuery(gfall, query)

# Print the results
print(df)

# Load ggplot2 for visualization
library(ggplot2)

# Plot the histogram
ggplot(df, aes(x=reorder(family, gall_count), y=gall_count)) +
  geom_col() +
  coord_flip() +
  labs(x="Plant Family", y="Number of Galls", title="Number of Galls Associated with Each Plant Family") +
  theme_minimal()


query <- "
WITH UniqueGallNames AS (
    SELECT DISTINCT 
        LOWER(TRIM(
            CASE 
                WHEN instr(s.name, '(') > 0 
                THEN substr(s.name, 1, instr(s.name, '(') - 1)  -- Remove parentheses content
                ELSE s.name 
            END
        )) AS base_name,
        h.host_species_id,
        gs.gall_id
    FROM gallspecies gs
    JOIN host h ON gs.species_id = h.gall_species_id
    JOIN species s ON gs.species_id = s.id
)
SELECT t2.name AS family, 
       COUNT(DISTINCT u.gall_id) AS total_galls,  -- Total gall occurrences per family
       COUNT(DISTINCT u.base_name) AS unique_gall_species -- Unique gall species per family
FROM UniqueGallNames u
JOIN species s ON u.host_species_id = s.id
JOIN speciestaxonomy st ON s.id = st.species_id
JOIN taxonomy t1 ON st.taxonomy_id = t1.id  -- Get genus
JOIN taxonomy t2 ON t1.parent_id = t2.id  -- Get family
WHERE t1.type = 'genus' AND t2.type = 'family'
GROUP BY t2.name
ORDER BY total_galls DESC;
"

df <- dbGetQuery(gfall, query)

# Print the results
print('Total Gall Occurrences and Unique Gall Species per Plant Family:')
print(df)

query <- "
WITH UniqueGallNames AS (
    SELECT DISTINCT 
        LOWER(TRIM(
            CASE 
                WHEN instr(s.name, '(') > 0 
                THEN substr(s.name, 1, instr(s.name, '(') - 1)  -- Remove parentheses content
                ELSE s.name 
            END
        )) AS base_name,
        h.host_species_id
    FROM gallspecies gs
    JOIN host h ON gs.species_id = h.gall_species_id
    JOIN species s ON gs.species_id = s.id
)
SELECT t2.name AS family, COUNT(DISTINCT u.base_name) AS gall_count
FROM UniqueGallNames u
JOIN species s ON u.host_species_id = s.id
JOIN speciestaxonomy st ON s.id = st.species_id
JOIN taxonomy t1 ON st.taxonomy_id = t1.id  -- Get genus
JOIN taxonomy t2 ON t1.parent_id = t2.id  -- Get family
WHERE t1.type = 'genus' AND t2.type = 'family'
GROUP BY t2.name
ORDER BY gall_count DESC;
"

df <- dbGetQuery(gfall, query)

# Plot the histogram
library(ggplot2)
ggplot(df, aes(x=reorder(family, gall_count), y=gall_count)) +
  geom_col() +
  coord_flip() +
  labs(x="Plant Family", y="Number of Unique Gall Species", title="Number of Unique Gall Species per Plant Family") +
  theme_minimal()
