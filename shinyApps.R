runApp("speciesList")
runApp("doyCalc")
table(observations$sourceURL)
table(observations$phenophase)


rsconnect::setAccountInfo(name='megachile', token='E0503725A47C8E1AA250F80A49C2A015', secret='vqQZJcHij1sJHt+8LtDwrCfLZURzoiSDyqzmXNdT')
library(rsconnect)
rsconnect::deployApp('C:/Users/adam/Documents/GitHub/Phenology/doyCalc')
rsconnect::deployApp('C:/Users/adam/Documents/GitHub/Phenology/speciesList')

# gallphen <- dbConnect(RSQLite::SQLite(), "gallphenReset.sqlite")
# observations <- dbGetQuery(gallphen, "SELECT observations.*, host.species AS host, gall.generation, gall.species, gall.genus FROM observations
#            LEFT JOIN species AS host ON observations.host_id = host.species_id
#            INNER JOIN species AS gall ON observations.gall_id = gall.species_id")
# observations$binom <- paste(observations$genus, observations$species)
# observations[observations$lifestage == "Adult"&observations$phenophase== "","phenophase"] <- "Adult"
# observations <- seasonIndex(observations)
# observations <- acchours(observations)
# write.csv(observations, file = "observations.csv", row.names = FALSE)