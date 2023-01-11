doy <- as.integer(format(as.Date("2022-06-15"),"%j"))
  
th <- 15
# Calculate the range of ten days before and after the doy value
doy_start <- doy - th
doy_end <- doy + th

# Construct the SQL query using the calculated DOY range
query <- paste0("SELECT observations.*, host.species AS host, gall.generation FROM observations
                LEFT JOIN species AS host ON observations.host_id = host.species_id
                INNER JOIN species AS gall ON observations.gall_id = gall.species_id
                WHERE DOY BETWEEN ", doy_start, " AND ", doy_end)

# Execute the query using dbGetQuery()
input <- dbGetQuery(gallphen, query)

data <- input
# data <- data[(data$generation=="sexgen"),]
# data <- data[data$doy>200,]
data <- data[!(data$phenophase=="developing"),]
data <- data[!(data$phenophase=="dormant"),]
data <- data[!(data$phenophase=="oviscar"),]
# data <- data[!(data$phenophase=="perimature"),]
data <- data[!(data$state=="CA"),]
# data <- seasonIndex(data)
# data <- acchours(data)

# Get the unique values of gall_id
gall_ids <- unique(data$gall_id)

# Iterate through the gall_ids and execute the query for each value
for (id in gall_ids) {
  if (!is.na(id)) {
    query <- paste("SELECT * FROM species WHERE species_id ='", id, "'", sep = "")
    result <- dbGetQuery(gallphen, query)
    print(paste(result$genus,result$species))
  }
}
