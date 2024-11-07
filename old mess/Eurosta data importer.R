library(DBI)
library(lubridate)
library(dplyr)
library(stringr)
library(tidyr)
library(ggmap)
library(DT)
source("iNatImportFunctions.R")
wd <- "C:/Users/adam/Documents/GitHub/Phenology"
setwd(wd)
gallphen <- dbConnect(RSQLite::SQLite(), "gallphenReset.sqlite")

eur <- read.csv(paste0(wd,"/EurostaData.csv"))


# Function to convert DOY to date (with specified year)
doy_to_date <- function(doy, year) {
  as.Date(doy - 1, origin = paste0(year, "-01-01"))
}

# Step 1: Rename and adjust latitude/longitude columns
eur <- eur %>%
  rename(latitude = Site.Coordinate..N.,
         longitude = Site.Coordinate..W.) %>%
  mutate(longitude = -abs(longitude))  # Make sure longitude is negative

# Step 2 & 3: Separate each entry into three records and replace host plant
eur_long <- eur %>%
  pivot_longer(cols = c(minDate, meanDate, maxDate),
               names_to = "date_type",
               values_to = "doy") %>%
  mutate(
    phenophase = "maturing",
    host_id = 443,
    gall_id = 760,
    date = doy_to_date(doy, 2024),  # Assuming 2024 for the original data
    country = "USA",
    site = Site.Full.Name,
    sourceURL = "linyi.zhang@email.gwu.edu"
  )

# Step 4: Select and rename columns
eur_final <- eur_long %>%
  select(gall_id, host_id, phenophase, date, doy, latitude, longitude, site, country, sourceURL) %>%
  mutate(
    pageURL = NA_character_,
    lifestage = "Adult",
    viability = NA_character_,
    state = NA_character_,
    AGDD32 = NA_real_,
    AGDD50 = NA_real_,
    yearend32 = NA_real_,
    yearend50 = NA_real_,
    percent32 = NA_real_,
    percent50 = NA_real_
  )

# Step 5: Add additional data
additional_data <- tribble(
  ~gall_id, ~host_id, ~latitude, ~longitude, ~site, ~state, ~country, ~year, ~start_date, ~peak_date, ~end_date, ~sourceURL,
  760, 443, 45.409579, -93.199758, "Cedar Creek Natural History Area", "MN", "USA", 1993, "1993-05-31", "1993-06-08", "1993-06-13", "https://bioone.org/journals/The-American-Midland-Naturalist/volume-142/issue-1/0003-0031(1999)142[0162:IOPGAE]2.0.CO;2/Influence-of-Plant-Genotype-and-Early-season-Water-Deficits-on/10.1674/0003-0031(1999)142[0162:IOPGAE]2.0.CO;2.short",
  760, 443, 45.409579, -93.199758, "Cedar Creek Natural History Area", "MN", "USA", 1994, "1994-05-26", "1994-05-29", "1994-06-10", "https://bioone.org/journals/The-American-Midland-Naturalist/volume-142/issue-1/0003-0031(1999)142[0162:IOPGAE]2.0.CO;2/Influence-of-Plant-Genotype-and-Early-season-Water-Deficits-on/10.1674/0003-0031(1999)142[0162:IOPGAE]2.0.CO;2.short",
  760, 443, 44.030083, -79.533782, "Koffler Scientific Reserve at Jokers Hill", "ON", "Canada", 2022, "2022-05-28", "2022-05-30", "2022-06-08", "linyi.zhang@email.gwu.edu"
)

additional_data_long <- additional_data %>%
  pivot_longer(cols = c(start_date, peak_date, end_date),
               names_to = "date_type",
               values_to = "date") %>%
  mutate(
    date = as.Date(date),
    phenophase = "maturing",
    doy = yday(date),
    pageURL = NA_character_,
    lifestage = "Adult",
    viability = NA_character_,
    AGDD32 = NA_real_,
    AGDD50 = NA_real_,
    yearend32 = NA_real_,
    yearend50 = NA_real_,
    percent32 = NA_real_,
    percent50 = NA_real_
  )

# Combine the original and additional data
final_data <- bind_rows(eur_final, additional_data_long)

# Define the full list of columns in the correct order
full_columns <- c("gall_id", "host_id", "sourceURL", "pageURL", "phenophase", 
                  "lifestage", "viability", "date", "doy", "latitude", "longitude", 
                  "site", "state", "country", "AGDD32", "AGDD50", "yearend32", 
                  "yearend50", "percent32", "percent50")

# Ensure final data has all columns in the correct order
final_data <- final_data %>%
  select(all_of(full_columns))
final_data <- seasonIndex(final_data)
final_data <- acchours(final_data)

dbAppendTable(gallphen, "observations",final_data)
