library(rsconnect)
library(pracma)
library(solrad)
library(DBI)
library(httr)
library(curl)
options(rsconnect.packrat = TRUE)
wd <- "C:/Users/adam/Documents/GitHub/Phenology"
setwd(wd)
gallphen <- dbConnect(RSQLite::SQLite(), "gallphenReset.sqlite")

#extract the subset of the pheno DB as used for the phenology tool

observations <- dbGetQuery(gallphen, "SELECT observations.*, host.species AS host, gall.generation, gall.species, gall.genus, gall.gf_id FROM observations
           LEFT JOIN species AS host ON observations.host_id = host.species_id
           INNER JOIN species AS gall ON observations.gall_id = gall.species_id")

# process the data into the required form
observations$gfURL <- paste0("https://gallformers.org/gall/", observations$gf_id)
observations$binom <- paste(observations$genus, observations$species)
observations[observations$lifestage == "Adult"&observations$phenophase== "","phenophase"] <- "Adult"
dbDisconnect(gallphen)
#write the new data into the necessary folder
write.csv(observations, file = paste0(wd, "/doyCalc/observations.csv"), row.names = FALSE)
# beep()
#connect to the hosting service and upload the new info. 
rsconnect::setAccountInfo(name='megachile', token='E0503725A47C8E1AA250F80A49C2A015', secret='vqQZJcHij1sJHt+8LtDwrCfLZURzoiSDyqzmXNdT')
rsconnect::deployApp(paste0(wd, '/doyCalc'))

