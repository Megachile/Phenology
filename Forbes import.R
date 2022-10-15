library(readxl)

CAsheet <- multiplesheets(paste0(wd,"/CAgalls.xlsx"))
CAsites <- read.csv(paste0(wd,"/CAsites.csv"))
CArecords <- read.csv(paste0(wd,"/CArecords.csv"))

multiplesheets <- function(fname) {
  
  # getting info about all excel sheets
  sheets <- readxl::excel_sheets(fname)
  tibble <- lapply(sheets, function(x) readxl::read_excel(fname, sheet = x))
  data_frame <- lapply(tibble, as.data.frame)
  
  # assigning names to data frames
  names(data_frame) <- sheets
  
  # print data frame
  print(data_frame)
}

key <- CAsheet[[1]]

# use GF_id to fill gall_id
for (i in 1:dim(key)[1]){
  key$gall_id[i] <- dbGetQuery(gallphen, str_interp("SELECT species_id FROM species
                                                      WHERE gf_id = '${key$gf_id[i]}'"))
}

# use host_species to fill host_id
for (i in 1:dim(key)[1]){
  key$host_id[i] <- dbGetQuery(gallphen, str_interp("SELECT species_id FROM species
                                                      WHERE genus = '${key$genus[i]}' AND species LIKE '%${key$species[i]}%'"))
}

#convert new ID columns back to vectors
key$gall_id <- unlist(key$gall_id)
key$host_id <- unlist(key$host_id)

CAkey <- key[,c(1,11,12)]
CArecords$date <- gsub("/","-",CArecords$date)
CArecords$date <- as.Date(CArecords$date, tryFormats = "%m-%d-%Y")

CArecords <- merge(CArecords, CAkey, by="code")
CArecords <- merge(CArecords, CAsites, by="collection")
CArecords$gall_id <- unlist(CArecords$gall_id)
str(CArecords)

CArecords$sourceURL <- "https://www.biorxiv.org/content/10.1101/2022.02.11.480154v1.abstract"
CArecords$pageURL <- NA
CArecords$doy <- yday(CArecords$date)
CArecords$code <- NULL
CArecords$collection <- NULL
CArecords$AGDD32 <- NA
CArecords$AGDD50 <- NA
CArecords$yearend32 <- NA
CArecords$yearend50 <- NA
CArecords$percent32 <- NA
CArecords$percent50 <- NA
# dbAppendTable(gallphen, "observations",CArecords)

