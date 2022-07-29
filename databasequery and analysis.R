library(DBI)
library(dbx)
library(tidyr)
library(sjmisc)
library(RSQLite)
library(rinat)
library(stringr)
library(ggplot2)
library(lubridate)
wd <- "C:/Users/adam/Documents/GitHub/gallformers/Phenology"
setwd(wd)
gallphen <- dbConnect(RSQLite::SQLite(), "gallphen.sqlite")
gfall <- dbConnect(RSQLite::SQLite(), "gallformers.sqlite")
dbDisconnect(mydb)


# dbAppendTable(gallphen, "observations",proces)




# # dbExecute(gallphen, "DELETE FROM observations WHERE gall_id IS NULL") 

# for (i in 1:dim(agdd)){
# agdd$host_id[i] <- dbGetQuery(gallphen, str_interp("SELECT species_id FROM species WHERE inatcode='${agdd$Host_Plant_ID[i]}'"))
# }
# 
# for (i in 1:dim(agdd)[1]){
#   if (agdd$Host_Plant_ID[i]=="54780"){
#   agdd$gall_id[i] <- dbGetQuery(gallphen, str_interp("SELECT species_id FROM species WHERE genus = 'Neuroterus' AND species LIKE '%quercusbatatus%' AND generation = '${agdd$Gall_generation[i]}' AND species LIKE '%bicolor%'"))
#   } else {
#     agdd$gall_id[i] <- dbGetQuery(gallphen, str_interp("SELECT species_id FROM species WHERE genus = 'Neuroterus' AND species LIKE '%quercusbatatus%' AND generation = '${agdd$Gall_generation[i]}' AND species NOT LIKE '%bicolor%'"))
#     }
# }
# 

# 
# check <- dbGetQuery(gallphen, "SELECT observations.AGDD32  FROM observations JOIN species USING (species_id) WHERE host_id = 297")
# # dbAppendTable(gallphen, "observations", proc)
# 
# dbGetQuery(gallphen, "SELECT gf_id FROM species  
#            WHERE genus = 'Neuroterus' AND species LIKE '%quercusbatatus%'")
# 
# dbGetQuery(gallphen, "SELECT species_id FROM species  
#            WHERE genus = 'Quercus' AND species = 'bicolor'")


obscheck <- dbGetQuery(gallphen, "SELECT * FROM observations")


dbExecute(gallphen, "UPDATE species SET inatcode = 49013
          WHERE genus = 'Quercus' AND species = 'virginiana'")



# dbExecute(gallphen, "UPDATE observations SET gall_id = 751
#           WHERE pageURL='https://www.inaturalist.org/observations/83974235'")
# dbGetQuery(gallphen, "SELECT * FROM observations 
#           WHERE pageURL='https://www.inaturalist.org/observations/87536229'")

dbExecute(gallphen, "DELETE FROM observations 
           WHERE pageURL='https://www.inaturalist.org/observations/108101104'")


dbGetQuery(gallphen, "SELECT * FROM species WHERE species LIKE '%quercusbatatus%'")

nqb <- dbGetQuery(gallphen, "SELECT observations.*, host.species AS host, gall.generation FROM observations 
                             INNER JOIN species AS host ON observations.host_id = host.species_id
                             INNER JOIN species AS gall ON observations.gall_id = gall.species_id
                             WHERE gall_id in (SELECT species_id FROM species
                             WHERE species LIKE '%quercusbatatus%')")

# dbGetQuery(gallphen, "SELECT * FROM species
# WHERE species_id in (SELECT distinct host_id FROM observations) 





nnox <- nqb[nqb$host_id==297,]
nqbss <- nqb[!nqb$host_id==297,]

old <- nqb[year(nqb$date)<2000,]
new <- nqb[!is.na(nqb$AGDD32),]
new <- new[!new$phenophase=="dormant",]
new <- new[!new$phenophase=="developing",]


x <- bkimp
y <- eas



doyLatRanges(esol,eas)


dor <- nqb[nqb$phenophase=="dormant",]
mat <- mat[!mat$phenophase=="developing",]


p = ggplot(data = nqb, aes(x = doy, y = latitude, color=generation, shape=phenophase,size=22)) + 
  geom_point() +
  # + xlim(100,200)
  geom_abline(intercept = 25.5, slope=.1265)+
  geom_abline(intercept = 19.25, slope=.1265)+
  geom_abline(intercept = 31, slope=.1265)
p

p = ggplot(data = nqb, aes(x = AGDD32, y = latitude, color=generation, shape=phenophase,size=22)) + 
  geom_point() 
# + xlim(100,200)
p




esol <- dbGetQuery(gallphen, "SELECT * FROM observations 
                             WHERE gall_id in (SELECT species_id FROM species
                             WHERE species = 'solidaginis')")
esol$phenostage <- paste0(esol$phenophase,esol$lifestage)


solflor <- dbGetQuery(gallphen, "SELECT observations.*, host.species AS host FROM observations
                      INNER JOIN species AS host ON observations.host_id = host.species_id
                      WHERE gall_id is NULL or gall_id = '' AND host_id in (SELECT species_id FROM species
                             WHERE genus = 'Solidago')")



# esolad <- esolad[!(esolad$pageURL=="https://www.inaturalist.org/observations/108101104"),]
esolad <- esol[!esol$phenostage=="developing",]
esolad <- esolad[!esolad$phenostage=="dormant",]
esolad <- esolad[!esolad$phenophase=="dormant",]


esolad[which(esolad$pageURL=="maturing"&esolad$percent50<.06),] <- NA
esolad <- esolad[!is.na(esolad$gall_id),]


fivenum(esolad$AGDD32)



p = ggplot(data = esolad, aes(x = doy, y = AGDD32, color=phenophase, shape=phenostage,size=22)) + 
  geom_point()+
  geom_hline(yintercept = 900)+
  geom_hline(yintercept = 2050)
# geom_abline(intercept = 18, slope=.182)+
# geom_abline(intercept = 20, slope=.135)
#geom_abline(intercept = 130, slope=-.40)+
# geom_abline(intercept = 155, slope=-.40)
p


p = ggplot(data = esolad, aes(x = doy, y = latitude, color=phenophase, shape=phenostage,size=22)) + 
  geom_point()+
  geom_abline(intercept = 22.9, slope=.162)+
  geom_abline(intercept = 17.3, slope=.176)+
  geom_abline(intercept = 14.3, slope=.176)
#geom_abline(intercept = 130, slope=-.40)+
# geom_abline(intercept = 155, slope=-.40)
p

mean(esolad$AGDD32, na.rm=TRUE)
sd(esolad$AGDD32, na.rm=TRUE)


p = ggplot(data = esolad, aes(x = percent32, y = latitude, color=phenophase, shape=phenostage,size=22)) + 
  geom_point() +
geom_vline(xintercept = .125)+
  geom_vline(xintercept = .25)
p

check <- esolad[which(esolad$phenostage=="AdultAdult"&esolad$doy<100),]

for (i in 1:20){
  browseURL(check$pageURL[i])
}

esolad[esolad$phenophase=="Adult",]
check <- check[order(check$AGDD32),]
check <- check[check$doy<100,]


flor <- solflor[solflor$phenophase=="Flowering",]
flor <- flor[flor$country=="CA",]
p = ggplot(data = flor, aes(x = doy, y = latitude, color=host,shape=host,size=22)) + 
  geom_point()
# + geom_abline(intercept = 130, slope=-.40)+
# geom_abline(intercept = 155, slope=-.40)
p
