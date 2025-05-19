# Load required libraries
library(DBI)
library(RSQLite)
library(dplyr)
library(tidyr)
library(ggplot2)

# Set working directory and connect to SQLite database
setwd("C:/Users/adam/Documents/GitHub/Phenology")
gfall <- dbConnect(SQLite(), "gallformers022725.sqlite")

# -------------------------------------
# ???? Extract and Plot: Total Galls per Host Family
# -------------------------------------
query_host_family_fixed <- "
WITH GenusToFamily AS (
    SELECT t1.id AS genus_id, t1.name AS genus, t2.id AS family_id, t2.name AS family
    FROM taxonomy t1
    JOIN taxonomy t2 ON t1.parent_id = t2.id
    WHERE t1.type = 'genus' AND t2.type = 'family'
)
SELECT gtf.family, COUNT(DISTINCT gs.gall_id) AS gall_count
FROM gallspecies gs
JOIN host h ON gs.species_id = h.gall_species_id
JOIN species s ON h.host_species_id = s.id
JOIN speciestaxonomy st ON s.id = st.species_id
JOIN GenusToFamily gtf ON st.taxonomy_id = gtf.genus_id
GROUP BY gtf.family
ORDER BY gall_count DESC;
"

df_host_family_fixed <- dbGetQuery(gfall, query_host_family_fixed)

# Print top results to verify
print(head(df_host_family_fixed, 10))

# Plot the histogram
ggplot(df_host_family_fixed, aes(x=reorder(family, gall_count), y=gall_count)) +
  geom_col(fill="steelblue") +
  coord_flip() +
  labs(x="Plant Family", y="Number of Galls", title="Number of Galls per Host Plant Family") +
  theme_minimal()


# -------------------------------------
# ???? Extract and Plot: Unique Gall Species per Host Family
# -------------------------------------
query_unique_galls <- "
WITH UniqueGallNames AS (
    SELECT DISTINCT 
        LOWER(TRIM(
            CASE 
                WHEN instr(s.name, '(') > 0 
                THEN substr(s.name, 1, instr(s.name, '(') - 1)  
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
       COUNT(DISTINCT u.gall_id) AS total_galls,  
       COUNT(DISTINCT u.base_name) AS unique_gall_species
FROM UniqueGallNames u
JOIN species s ON u.host_species_id = s.id
JOIN speciestaxonomy st ON s.id = st.species_id
JOIN taxonomy t1 ON st.taxonomy_id = t1.id  
JOIN taxonomy t2 ON t1.parent_id = t2.id  
WHERE t1.type = 'genus' AND t2.type = 'family'
GROUP BY t2.name
ORDER BY total_galls DESC;
"

df_unique_galls <- dbGetQuery(gfall, query_unique_galls)

ggplot(df_unique_galls, aes(x=reorder(family, unique_gall_species), y=unique_gall_species)) +
  geom_col(fill="darkorange") +
  coord_flip() +
  labs(x="Plant Family", y="Number of Unique Gall Species", title="Unique Gall Species per Host Plant Family") +
  theme_minimal()

# -------------------------------------
# ???? Extract and Plot: Number of Galls per Inducer Family
# -------------------------------------
query_inducer_family <- "
WITH UniqueInducerNames AS (
    SELECT DISTINCT 
        LOWER(TRIM(
            CASE 
                WHEN instr(s.name, '(') > 0 
                THEN substr(s.name, 1, instr(s.name, '(') - 1)  
                ELSE s.name 
            END
        )) AS base_name,
        gs.species_id
    FROM gallspecies gs
    JOIN species s ON gs.species_id = s.id
)
SELECT t2.name AS family, COUNT(DISTINCT u.base_name) AS gall_count
FROM UniqueInducerNames u
JOIN species s ON u.species_id = s.id
JOIN speciestaxonomy st ON s.id = st.species_id
JOIN taxonomy t1 ON st.taxonomy_id = t1.id  
JOIN taxonomy t2 ON t1.parent_id = t2.id  
WHERE t1.type = 'genus' AND t2.type = 'family'
GROUP BY t2.name
ORDER BY gall_count DESC;
"

df_inducer_family <- dbGetQuery(gfall, query_inducer_family)

ggplot(df_inducer_family, aes(x=reorder(family, gall_count), y=gall_count)) +
  geom_col(fill="forestgreen") +
  coord_flip() +
  labs(x="Inducer Family", y="Number of Galls", title="Number of Galls per Inducer Family") +
  theme_minimal()

# -------------------------------------
# ??? Done! You now have three histograms:
# 1. Total Galls per Host Family (Blue)
# 2. Unique Gall Species per Host Family (Orange)
# 3. Number of Galls per Inducer Family (Green)
# -------------------------------------

# Count occurrences of each gall form
df_form <- dbGetQuery(gfall, "
SELECT f.form, COUNT(*) AS count
FROM gallform gf
JOIN form f ON gf.form_id = f.id
GROUP BY f.form
ORDER BY count DESC;
")

# Count occurrences of each gall color
df_color <- dbGetQuery(gfall, "
SELECT c.color, COUNT(*) AS count
FROM gallcolor gc
JOIN color c ON gc.color_id = c.id
GROUP BY c.color
ORDER BY count DESC;
")

# Count occurrences of each gall texture
df_texture <- dbGetQuery(gfall, "
SELECT t.texture, COUNT(*) AS count
FROM galltexture gt
JOIN texture t ON gt.texture_id = t.id
GROUP BY t.texture
ORDER BY count DESC;
")

# Count occurrences of each gall shape
df_shape <- dbGetQuery(gfall, "
SELECT s.shape, COUNT(*) AS count
FROM gallshape gs
JOIN shape s ON gs.shape_id = s.id
GROUP BY s.shape
ORDER BY count DESC;
")

# Count occurrences of each gall wall type
df_walls <- dbGetQuery(gfall, "
SELECT w.walls, COUNT(*) AS count
FROM gallwalls gw
JOIN walls w ON gw.walls_id = w.id
GROUP BY w.walls
ORDER BY count DESC;
")

# Count occurrences of each gall cell type
df_cells <- dbGetQuery(gfall, "
SELECT c.cells, COUNT(*) AS count
FROM gallcells gc
JOIN cells c ON gc.cells_id = c.id
GROUP BY c.cells
ORDER BY count DESC;
")

# Count occurrences of each gall alignment
df_alignment <- dbGetQuery(gfall, "
SELECT a.alignment, COUNT(*) AS count
FROM gallalignment ga
JOIN alignment a ON ga.alignment_id = a.id
GROUP BY a.alignment
ORDER BY count DESC;
")


ggplot(df_form, aes(x=reorder(form, count), y=count)) +
  geom_col(fill="steelblue") +
  coord_flip() +
  labs(x="Gall Form", y="Count", title="Distribution of Gall Forms") +
  theme_minimal()

ggplot(df_color, aes(x=reorder(color, count), y=count)) +
  geom_col(fill="tomato") +
  coord_flip() +
  labs(x="Gall Color", y="Count", title="Distribution of Gall Colors") +
  theme_minimal()

ggplot(df_shape, aes(x=reorder(shape, count), y=count)) +
  geom_col(fill="purple") +
  coord_flip() +
  labs(x="Gall Shape", y="Count", title="Distribution of Gall Shapes") +
  theme_minimal()

ggplot(df_walls, aes(x=reorder(walls, count), y=count)) +
  geom_col(fill="green") +
  coord_flip() +
  labs(x="Gall Walls", y="Count", title="Distribution of Gall Wall Types") +
  theme_minimal()

ggplot(df_cells, aes(x=reorder(cells, count), y=count)) +
  geom_col(fill="darkred") +
  coord_flip() +
  labs(x="Gall Cells", y="Count", title="Distribution of Gall Cell Types") +
  theme_minimal()

ggplot(df_alignment, aes(x=reorder(alignment, count), y=count)) +
  geom_col(fill="darkblue") +
  coord_flip() +
  labs(x="Gall Alignment", y="Count", title="Distribution of Gall Alignments") +
  theme_minimal()


df_galls_by_state <- dbGetQuery(gfall, "
SELECT p.name AS state, COUNT(DISTINCT gs.gall_id) AS num_galls
FROM gallspecies gs
JOIN host h ON gs.species_id = h.gall_species_id
JOIN speciesplace sp ON h.host_species_id = sp.species_id
JOIN place p ON sp.place_id = p.id
WHERE p.type = 'state'
GROUP BY p.name
ORDER BY num_galls DESC;
")

# Print summary stats
cat("Total states with recorded gall occurrences:", nrow(df_galls_by_state), "\n")
print(head(df_galls_by_state, 10))  # Show top 10 states


library(ggplot2)
library(maps)
library(dplyr)

# Load US states map
states_map <- map_data("state")

# Ensure state names match between dataset and map_data
df_galls_by_state <- df_galls_by_state %>%
  mutate(state = tolower(state))

# Merge dataset with map data
state_map_data <- states_map %>%
  left_join(df_galls_by_state, by = c("region" = "state"))

# Plot heatmap with reversed scale (darker = more galls)
ggplot(state_map_data, aes(x = long, y = lat, group = group, fill = num_galls)) +
  geom_polygon(color = "black") +
  scale_fill_viridis_c(option = "plasma", direction = -1, na.value = "white") + 
  labs(title = "Gall Distribution by State (Based on Host Ranges)",
       fill = "Number of Galls") +
  theme_minimal()

write.csv(df_host_family_fixed, file = "df_host_family_fixed.csv", row.names = FALSE)

