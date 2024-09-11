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

# Define the URLs
urls <- c("http://www.inaturalist.org/observations/74845187")

# Function to get the end part of the URL
get_url_end <- function(url) {
  sub("^https?://", "", url)
}

# Create the query string using LIKE for partial matching
url_patterns <- sapply(urls, get_url_end)
query <- paste0("WHERE ", paste(sapply(url_patterns, function(pattern) {
  paste0("pageURL LIKE '%", pattern, "'")
}), collapse = " OR "))

# look up ID codes
select <- paste0("SELECT species_id from species WHERE gf_id = '919'")
dbGetQuery(gallphen, select)

# look up observations
select <- paste0("SELECT * FROM observations ", query)
data <- dbGetQuery(gallphen, select)

# Uncomment the following lines if you need to perform updates or deletions
update <- paste0("UPDATE observations SET viability = 'viable' ", query)
dbExecute(gallphen, update)
data <- dbGetQuery(gallphen, select)

# delete <- paste0("DELETE FROM observations ", query)
# dbExecute(gallphen, delete)

# Don't forget to close the database connection when you're done
dbDisconnect(gallphen)