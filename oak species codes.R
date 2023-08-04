library(DBI)
wd <- "C:/Users/adam/Documents/GitHub/Phenology"
setwd(wd)
# gallphen <- dbConnect(RSQLite::SQLite(), "gallphenReset.sqlite")
gfall <- dbConnect(RSQLite::SQLite(), "gallformers.sqlite")

species_names <- dbGetQuery(gfall, "SELECT name FROM species WHERE name LIKE '%quercus %'")
species_names <- species_names$name
species_specific <- gsub("^\\w+\\s", "", species_names)
species_names <- sub("^x\\s", "", species_specific)

codes <- vector("character", length(species_names))
# Loop through the species names and assign codes

for (i in seq_along(species_names)) {
  # Extract the first two letters of the species name
  code <- substr(species_names[i], 1, 2)
  
  # Check if the code has already been used
  if (code %in% codes) {
    # If the code has already been used, add the next available letter to the end
    # of the code until it is unique
    j <- 1
    while (paste0(code, j) %in% codes) {
      j <- j + 1
    }
    code <- paste0(code, j)
  }
  
  # Assign the code to the current species
  codes[i] <- code
}

# Print the results
data.frame(species = species_names, code = codes)

