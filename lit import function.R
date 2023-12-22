library(DBI)
library(lubridate)
library(dplyr)
library(stringr)
library(ggmap)
library(DT)
# data <- dbGetQuery(gallphen, "SELECT * FROM observations WHERE sourceURL = 'https://www.gallformers.org/source/9'")

#import file
# fnsites <- read.csv(paste0(wd,"/FNsites.csv"))
# fnsites <- fnsites[,1:5]
wd <- "C:/Users/adam/Documents/GitHub/Phenology"
setwd(wd)
gallphen <- dbConnect(RSQLite::SQLite(), "gallphenReset.sqlite")

register_google(key = "AIzaSyDoIENLQOpwK4CumSUREYM3vWyEwq3LgKg")

lit <- read.csv(paste0(wd,"/litimport11.csv"))
lit <- lit[!is.na(lit$gf_id),]


# Function to clean trailing spaces
clean_trailing_spaces <- function(column) {
  if(is.character(column)) {
    return(trimws(column, which = "right"))
  } else {
    return(column)
  }
}

# Apply the cleaning function to each column in the dataframe
lit <- data.frame(lapply(lit, clean_trailing_spaces))

#remove duplicates (K decidua, K rileyi, X q forticorne, D q flocci)
# lit <- lit[!(lit$gf_id=="577"|lit$gf_id=="735"|lit$gf_id=="851"|lit$gf_id=="865"|lit$gf_id=="764"|lit$gf_id=="1340"|lit$gf_id=="1317"|lit$gf_id=="1339"),]

# use GF_id to fill gall_id
for (i in 1:dim(lit)[1]){
lit$gall_id[i] <- dbGetQuery(gallphen, str_interp("SELECT species_id FROM species
                                                      WHERE gf_id = '${lit$gf_id[i]}'"))
}

lit <- lit[lit$gall_id != "integer(0)", ]

# use host_species to fill host_id
for (i in 1:dim(lit)[1]){
lit$host_id[i] <- dbGetQuery(gallphen, str_interp("SELECT species_id FROM species
                                                      WHERE genus = '${lit$genus[i]}' AND species LIKE '%${lit$species[i]}%'"))
}

# lit$doy <- yday(lit$date)

lit[lit$host_id=="integer(0)",5] <- NA

#convert new ID columns back to vectors
lit$gall_id <- unlist(lit$gall_id)
lit$host_id <- unlist(lit$host_id)

# convert XXXX- dates to doy and delete
for (i in 1:dim(lit)[1]){
  if (grepl('xxxx', lit$date[i], ignore.case = TRUE)) {
    lit$date[i] <- gsub('xxxx', '2021', lit$date[i], ignore.case = TRUE)
    lit$doy[i] <- yday(lit$date[i])
    lit$date[i] <- NA
  } else {
    date_string <- lit$date[i]
    if (grepl("/", date_string)) {
      date_object <- strptime(date_string, "%m/%d/%Y")
      lit$date[i] <- as.character(date_object, format = "%Y-%m-%d")
    }
    lit$doy[i] <- yday(lit$date[i])
  }
}

# site <- unique(lit$site)
# sites <- data.frame(matrix(ncol = 4, nrow =178))
# colnames(sites) <- c('latitude','longitude','state','country')
# sites <- cbind(site,sites)
# write.csv(sites,paste0(wd,"/sitesblank.csv"))
# 
# fnlatlong <- geocode(fnsites, city=site, state=state,country=country)
# write.csv(fnlatlong,paste0(wd,"/sitesfilled.csv"))

# use site to fill in lat/long state and country
# setdiff(unique(lit$site), unique(fnsites$site))
# lit <- lit[,!(names(lit) %in% c("latitude","longitude","state","country"))]
# lit <- merge(lit, fnsites, by = "site",all.x=TRUE)
lit <- lit[,!(names(lit) %in% c("gf_id","genus","species"))]

# Add unique identifier
lit$row_id <- seq_len(nrow(lit))

# Split data based on conditions
no_site_with_coords <- lit[lit$site == "" & !is.na(lit$latitude) & !is.na(lit$longitude), ]
site_no_coords <- lit[!lit$site == "" & is.na(lit$latitude) | is.na(lit$longitude), ]
site_with_coords <- lit[!lit$site == "" & !is.na(lit$latitude) & !is.na(lit$longitude), ]

# Geocode for rows with site but no coordinates
if (nrow(site_no_coords) > 0) {
site_no_coords$full_address <- paste(site_no_coords$site, site_no_coords$state, site_no_coords$country, sep = ", ")
unique_addresses <- unique(site_no_coords[, c("full_address", "row_id")])
geocoded_results <- ggmap::geocode(unique_addresses$full_address)
geocoded_df <- data.frame(row_id = unique_addresses$row_id, 
                          geocoded_lat = geocoded_results$lat, 
                          geocoded_lon = geocoded_results$lon)
site_no_coords <- merge(site_no_coords, geocoded_df, by = "row_id", all.x = TRUE)
# Update coordinates in site_no_coords and site_with_coords
site_no_coords$latitude <- site_no_coords$geocoded_lat
site_no_coords$longitude <- site_no_coords$geocoded_lon
}

# Geocode for rows with site and coordinates
if (nrow(site_with_coords) > 0) {
site_with_coords$full_address <- paste(site_with_coords$site, site_with_coords$state, site_with_coords$country, sep = ", ")
unique_addresses_with_coords <- unique(site_with_coords[, c("full_address", "row_id")])
geocoded_results_with_coords <- ggmap::geocode(unique_addresses_with_coords$full_address)
geocoded_df_with_coords <- data.frame(row_id = unique_addresses_with_coords$row_id, 
                                      geocoded_lat = geocoded_results_with_coords$lat, 
                                      geocoded_lon = geocoded_results_with_coords$lon)
site_with_coords <- merge(site_with_coords, geocoded_df_with_coords, by = "row_id", all.x = TRUE)


# Compare and flag large differences
site_with_coords <- site_with_coords %>%
  mutate(
    lat_diff = abs(latitude - geocoded_lat),
    lon_diff = abs(longitude - geocoded_lon),
    flag_large_diff = ifelse(lat_diff > 1 | lon_diff > 1, TRUE, FALSE)
  )

flagged_rows <- subset(site_with_coords, flag_large_diff == TRUE)
if (nrow(flagged_rows) > 0) {
  datatable(flagged_rows, editable = TRUE)
}

# Incorporate edited flagged_rows back into site_with_coords
site_with_coords <- subset(site_with_coords, !flag_large_diff)
site_with_coords <- rbind(site_with_coords, flagged_rows)
}

# Define the full list of columns
full_columns <- c("gall_id", "host_id", "sourceURL", "pageURL", "phenophase", 
                  "lifestage", "viability", "date", "doy", "latitude", "longitude", 
                  "site", "state", "country", "AGDD32", "AGDD50", "yearend32", 
                  "yearend50", "percent32", "percent50")

# Function to standardize dataframe columns
standardize_columns <- function(df, full_columns) {
  # Check if the dataframe is empty
  if (nrow(df) == 0) {
    # Create a dataframe with the full columns filled with NA
    df <- data.frame(matrix(ncol = length(full_columns), nrow = 0))
    colnames(df) <- full_columns
  } else {
    # Add missing columns with NA values
    for (col in full_columns) {
      if (!col %in% names(df)) {
        df[[col]] <- NA
      }
    }
    # Ensure the dataframe has columns in the correct order
    df <- df[full_columns]
  }
  return(df)
}

# Standardize columns for each dataframe
no_site_with_coords <- standardize_columns(no_site_with_coords, full_columns)
site_no_coords <- standardize_columns(site_no_coords, full_columns)
site_with_coords <- standardize_columns(site_with_coords, full_columns)

# Recombine dataframes
combined_df <- rbind(no_site_with_coords, site_no_coords, site_with_coords)

#append to table
# dbAppendTable(gallphen, "observations",combined_df)
