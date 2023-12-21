library(rsconnect)
library(pracma)
library(solrad)
library(DBI)

# runApp("speciesList")
# runApp("doyCalc")
# functions to calculate a new column for the accumulated hours (adjusted for latitude) and the percent of same (seasonality index) of each observation in a dataframe
# must contain a latitude and doy column
pos_part <- function(x) {
  return(sapply(x, max, 0))
}

eqmod = function(x,lat=49) {((2*(24/(2*pi))*acos(-tan((lat*pi/180))*tan((pi*Declination(x-(1.8*lat-50) )/180))))-(0.1*lat+5)) }

acchours <- function(x){
  
  for (i in 1:dim(x)[1]){
    x$acchours[i] <- trapz(
      seq(1,x$doy[i]),
      (pos_part(eqmod(seq(1,x$doy[i]),x$latitude[i])*(90-x$latitude[i]))
       /max(eqmod(seq(1,365),x$latitude[i])) * (-1/200*x$latitude[i]+647/600) )  
    )
  }
  return(x)
}

eq = function(x,lat=49) {((2*(24/(2*pi))*acos(-tan((lat*pi/180))*tan((pi*Declination(x)/180))))-(0.1*lat+5)) }

seasonIndex <- function(x){
  
  for (i in 1:dim(x)[1]){
    x$seasind[i] <- trapz(seq(1,x$doy[i]),(pos_part(eq(seq(1,x$doy[i]),x$latitude[i]))))/trapz(seq(1,(365)),(pos_part(eq(seq(1,(365)),x$latitude[i]))))
  }
  return(x)
}

# table(observations$sourceURL)
# table(observations$phenophase)

wd <- "C:/Users/adam/Documents/GitHub/Phenology"
setwd(wd)
gallphen <- dbConnect(RSQLite::SQLite(), "gallphenReset.sqlite")
# update the observations dataframe for both apps
# gallphen <- dbConnect(RSQLite::SQLite(), "gallphenReset.sqlite")
# observations <- read.csv("observations.csv")


#extract the subset of the pheno DB as used for the phenology tool

observations <- dbGetQuery(gallphen, "SELECT observations.*, host.species AS host, gall.generation, gall.species, gall.genus, gall.gf_id FROM observations
           LEFT JOIN species AS host ON observations.host_id = host.species_id
           INNER JOIN species AS gall ON observations.gall_id = gall.species_id")


# process the data into the required form
observations$gfURL <- paste0("https://gallformers.org/gall/", observations$gf_id)
observations$binom <- paste(observations$genus, observations$species)
observations[observations$lifestage == "Adult"&observations$phenophase== "","phenophase"] <- "Adult"
observations <- seasonIndex(observations)
observations <- acchours(observations)
# length(unique(observations$gall_id))

#write the new data into the necessary folder
write.csv(observations, file = paste0(wd, "/doyCalc/observations.csv"), row.names = FALSE)

#connect to the hosting service and upload the new info. You need to press Y to begin the process.
rsconnect::setAccountInfo(name='megachile', token='E0503725A47C8E1AA250F80A49C2A015', secret='vqQZJcHij1sJHt+8LtDwrCfLZURzoiSDyqzmXNdT')
rsconnect::deployApp(paste0(wd, '/doyCalc'))
