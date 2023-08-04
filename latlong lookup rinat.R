wd <- "C:/Users/adam/Documents/GitHub/Phenology"
setwd(wd)
data <- read.csv(paste0(wd, "/rearingids.csv" ))
# Add a row number column to the original data frame to preserve order
data$row_number <- 1:nrow(data)


# Load the rinat package
library(rinat)
library(xml2)

# Remove NA observation IDs and get unique observation IDs to minimize API calls
unique_observation_ids <- na.omit(unique(data$id))

# Empty data frame to store the results
retrieved_data <- data.frame()


# Loop through each unique observation ID
for (obs_id in unique_observation_ids) {
  # Fetch observation data using the rinat package
  obs_data <- rinat::get_inat_obs_id(obs_id)
  Sys.sleep(1)
  # Check if data is not empty
  if (length(obs_data) > 0) {
    # Extract latitude and longitude directly from the obs_data list
    lat <- obs_data$latitude
    lon <- obs_data$longitude
    
    # Append the latitude and longitude to the retrieved_data data frame
    retrieved_data <- rbind(retrieved_data, data.frame(obs_id, lat, lon))
  }
}

# Merge the retrieved data with the original data
final_data <- merge(data, retrieved_data, by.x = "id", by.y = "obs_id", all.x = TRUE, sort = FALSE)

# Sort the final data by the row number to preserve original order
final_data <- final_data[order(final_data$row_number), ]

# Remove the row_number column as it is no longer needed
final_data$row_number <- NULL

# Write the final data to a CSV file
write.csv(final_data, "final_data_with_lat_lon.csv", row.names = FALSE)


