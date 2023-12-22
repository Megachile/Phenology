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

# sen <- input[which(input$phenophase=="dormant"&input$doy>20&input$doy<60),]
query <- paste0("WHERE gall_id = '2379'")
# query <- paste0("WHERE obs_id IN (", paste(sprintf("'%s'",sen$obs_id), collapse = ","),")")
query <- paste0("WHERE sourceURL LIKE '%source/396%'")
query <- paste0("WHERE obs_id = '31270'")

# look up ID codes. 
# The gf_id is what you see in the URL when you search a species on gallformers. The species_id is what the pheno db uses
select <- paste0("SELECT species_id from species WHERE gf_id = '2445'")
dbGetQuery(gallphen, select)

#look up observations
select <- paste0("SELECT * FROM observations ", query)
data <- dbGetQuery(gallphen, select)
update <- paste0("UPDATE observations SET gall_id = '2531'", query)
dbExecute(gallphen, update)
# delete <- paste0("DELETE FROM observations ", query)
# dbExecute(gallphen, delete)

