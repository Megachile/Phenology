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
# query <- paste0("WHERE obs_id IN (", paste(sprintf("'%s'",sen$obs_id), collapse = ","),")")
query <- paste0("WHERE pageURL ='https://www.inaturalist.org/observations/80534487'")
# query <- paste0("WHERE obs_id = '20257'")

select <- paste0("SELECT * FROM observations ", query)
dbGetQuery(gallphen, select)
update <- paste0("UPDATE observations SET phenophase = 'dormant'", query)
dbExecute(gallphen, update)
# delete <- paste0("DELETE FROM observations ", query)
# dbExecute(gallphen, delete)