library(jsonlite)
library(data.table)
# library(foreach)
# library(stringr)
library(tidyr)
# library(purrr)
# library(iNatTools)
# library(remotes)
# library(rinat)
library(lubridate)
library(dplyr)
library(plyr)
library(ddpcr)
library(rnpn)
library(ggplot2)
library(ggpmisc)
wd <- "C:/Users/adam/Documents/GitHub/gallformers/Phenology"
setwd(wd)

layers <- npn_get_layer_details()













  
  ## remove NAs if any, fix punctuation
  obs <- obs[!is.na(obs$longitude),]
  obs$observed_on <- gsub("/", "-", obs$observed_on)
  obs <- obs[!obs$Evidence_of_Presence=="Molt",]
  obs <- obs[!obs$latitude=="NA",]
  obs <- obs[!obs$longitude=="NA",]
  obs <- obs[!obs$observed_on=="NA",]
  
  #separate spring and fall dormant observations
  # dorm <- obs[obs$Gall_phenophase=="dormant",]
  # plot(dorm$doy, dorm$latitude)
  
  for (i in 1:dim(obs)[1]){
    if (obs$Gall_phenophase[i]=="dormant"){
      if (yday(obs$observed_on[i])>200){
        obs$Gall_phenophase[i] <- "dormfall"
      } else {
        obs$Gall_phenophase[i] <- "dormspring"
      } 
    }  else {
      obs <- obs
    }
  }
  
  ## Remove or correct any mislabelled data
  # obs <- obs[obs$Gall_phenophase=="oviscar",]
  obs$Life_Stage <- gsub("Egg", "", obs$Life_Stage)
  
  #create phenostage field and remove bad data 
  obs$phenostage <- paste0(obs$Gall_phenophase, obs$Life_Stage)
  obs <- obs[!obs$phenostage=="Larva",]
  obs <- obs[!obs$phenostage=="",]
  # unique(obs$phenostage)
  # obs$phenostage <- gsub("perimatureAdult", "Adult", obs$phenostage)
  # obs$phenostage <- gsub("dormspringAdult", "dormspring", obs$phenostage)
  # obs$phenostage <- gsub("developingAdult", "developingLarva", obs$phenostage)

  #read in previous agdd for a species if available
  prev <- read.csv(paste0(wd, "/esolidaginisagdd.csv"))
  names(obs)
  names(prev)
  obs$latitude <- as.double(obs$latitude)
  obs$longitude <- as.double(obs$longitude)
  typeof(obs$latitude)
  agdd <- merge_dfs_overwrite_col(prev, obs, cols=c("Evidence_of_Presence","Life_Stage","Gall_phenophase","phenostage"), bycol=c("id","observed_on","taxon.name","latitude","longitude","uri","doy"))
  agdd <- as.data.frame(join(obs,prev, by=c("id","observed_on","taxon.name","latitude","longitude","uri","doy"),type = "left", match="first"))
  
  ### first time look up of AGDD--!!!time consuming for large datasets!!! 
  agddt <- as.data.frame(lookUpAGDD(agddt))
  agdgdt <- as.data.frame(lookUpAGDD50(agddt))
  
  # leafdate <- as.data.frame(lookUpSinceLeaf(obs))
  # leafdate <- cbind(obs, leafdate) 
  agdd <- agddsav
  # agdd <- agdd[!agdd$phenophase=="dormant",]
  agdd <- agdd[!agdd$AGDD50=="-9999",]
  agdd <- agdd[!agdd$AGDD50=="NaN",]
  
  # boxplot(leafdate$sinceleaf~leafdate$phenogen, horizontal=T)
  agdd$phenogen <- paste(agdd$phenophase, agdd$lifestage, sep="_")
  
  boxplot(agdd$AGDD32~agdd$Gall_phenophase, horizontal=T)
  agdd$phenostage <- factor(agdd$phenostage, levels=c("Adult","developing","developing"))
  agdd[agdd$Gall_phenophase=="dormant",9:10] <- "dormfall"
  agdd <- agdd[!agdd$id==27471762,]
  adult <- agdd[agdd$Gall_phenophase=="dormspring" & agdd$AGDD32>2000,]
  adult <- adult[adult$doy<200,]
  plot(mat$doy, mat$latitude)
  
  year1 <- agdd[agdd$Gall_phenophase=="dormfall"|agdd$Gall_phenophase=="developing",]
  boxplot(year1$doy~year1$Gall_phenophase, horizontal=T)
  year1 <- year1[!year1$id==27228083,]
  year1$total32 <- year1$AGDD32
  year1$yr1AGDD32 <- year1$AGDD32
  year1$AGDD32 <- year1$yr1AGDD32
  year1$total50 <- year1$AGDD50
  year1$yr1AGDD50 <- year1$AGDD50
  year1$AGDD50 <- year1$yr1AGDD32
  year1$obsdate <- year1$observed_on
  
  year2 <- agdd[agdd$Gall_phenophase=="dormspring"|agdd$Gall_phenophase==""|agdd$Gall_phenophase=="maturing",]
  year2[year(year2$obsdate)<2022,15] <- NA
  year2$observed_on <- paste0(year(year2$obsdate)-1,"-12-31")
  year2$total32 <- year2$AGDD32 + year2$yr1AGDD32
  year2$total50 <- year2$AGDD50 + year2$yr1AGDD50
  agddt <- rbind(year1, year2)
  agddt <- agddt[!agddt$id==33960848,]
  agddt <- agddt[!agddt$id==98146166,]
  
  agddt$Gall_phenophaseyr2 <- agddt$Gall_phenophase
  agddt[which(agddt$Gall_phenophaseyr2=="dormspring"),]$Gall_phenophaseyr2 <- "dormant"
  [agddt$Gall_phenophase=="dormfall"|agddt$Gall_phenophase=="dormspring",] <- "dormant" 
  agddt <- agddt[!is.na(agddt$id),]
  agddt$phenostage2 <- paste0(agddt$Gall_phenophaseyr2, agddt$Life_Stage)
  colnames(esol)
  
  
  names(esol)[names(esol)=="curentyear50"] <- "yearend50"
  
  esol <- esol[,c(-14:-15)]
  write.csv(esol, paste0(wd,"/esolAGDDclean.csv"), row.names = FALSE)
  unique(agddt$phenostage2)
  
  agddt$phenostage2 <- factor(agddt$phenostage2, levels=c("developing","developingLarva","developingPupa","dormant","dormantLarva","dormantPupa","maturingAdult","Adult"))
  
  agddt$Gall_phenophaseyr2 <- factor(agddt$Gall_phenophaseyr2, levels=c("developing","dormant","maturing",""))
  agddt$percent50 <- NA
  
 for (i in 1:dim(agddt)[1]) {
   if (is.na(agddt$AGDD50[i])==FALSE){
     agddt$percent50[i] <- agddt$yr1AGDD50[i]/agddt$AGDD50[i]
   } else {
     agddt$percent50[i] <- NA
   }
 }

  # agddt[agddt$percent==1,17:18] <- NA
  agddt$observed_on <- paste0(year(agddt$obsdate)-1,"-12-31")
  agddt$observed_on <- gsub("2015","2016",agddt$observed_on)
  
  agddt$yearend <- paste0(year(agddt$obsdate),"-12-31")
  
  # agddt <- as.data.frame(lookUpAGDD(agddt))
  # agddt <- as.data.frame(lookUpAGDD50(agddt))
  
  # agddt[year(agddt$obsdate)==2022,23:24] <- NA
  
  names(agddt)[names(agddt)=="percent"] <- "percent32"
  
  # names(agddt)[names(agddt)=="yearend"] <- "observed_on"
  names(agddt)[names(agddt)=="observed_on"] <- "currentyearend"
  names(agddt)[names(agddt)=="AGDD32"] <- "currentyear32"
  names(agddt)[names(agddt)=="AGDD50"] <- "currentyear50"
  
  
  p = ggplot(data = agddt, aes(x = doy, y = latitude, shape=Gall_phenophaseyr2, color=phenostage2, size=22)) + 
    geom_point()
  p
  
  org <- agddt[!agddt$phenostage2=="dormant",]
  org <- org[!org$phenostage2=="developing",]

  p = ggplot(data = org, aes(x = wrapdoy, y = latitude, shape=Gall_phenophaseyr2, color=phenostage2, size=22)) + 
    geom_point()
  p
  
  require(plyr)
  dlply(org, .(Gall_phenophaseyr2), function(x) p %+% x + facet_wrap(~Gall_phenophaseyr2))

  thr <- 0.91

  check <- agddt[which(agddt$phenostage=="developing"&agddt$doy>261),]
  check <- check[order(-check$percent50),]
  
  for (i in 31:45){
    browseURL(check$uri[i])
  }
  
  for (i in 1:dim(agddt)[1]){
    if (agddt$phenostage[i]=="dormspring"|agddt$phenostage[i]=="dormspringLarva"|agddt$phenostage[i]=="dormspringPupa"|agddt$phenostage[i]=="maturingAdult"|agddt$phenostage[i]=="Adult"){
  agddt$wrapdoy[i] <- agddt$doy[i] + 365
  } else {
    agddt$wrapdoy[i] <- agddt$doy[i]   
      }
  }
  
  
  agddt[which(agddt$phenostage2=="developing"&agddt$doy>261),9] <- "dormfall"
  agddt[which(agddt$phenostage2=="developing"&agddt$doy>261),10] <- "dormfall"
  agddt[which(agddt$phenostage2=="developing"&agddt$doy>261),19] <- "dormant"
  agddt[which(agddt$phenostage2=="developing"&agddt$doy>261),20] <- "dormant"
  
  
  # agddt$lastpercent32 <- NULL
  # agddt$lastpercent50 <- NULL
  # 
  
  p = ggplot(data = agddt, aes(x = percent50, y = latitude, shape=Gall_phenophaseyr2, color=phenostage2, size=22)) + 
    geom_point() 
  p
  
  fix <- 96442753
  # agddt[agddt$id==fix,8] <- ""
  agddt[agddt$id==fix,9] <- "dormfall"
  agddt[agddt$id==fix,10] <- "dormfall"
  agddt[agddt$id==fix,19] <- "dormant"
  agddt[agddt$id==fix,20] <- "dormant"
  
  agddsav <- agddt
  
  agddt <- agddt[!agddt$id==27609045,]
  
 
  
  # boxplot(agdd50$agdd~agdd50$phenogen, horizontal=T)
  # plot(leafdate$Latitude, leafdate$sinceleaf)
  plot(agdd$Latitude, agdd$agdd)
  abline(a=5400,b=-115)
  # plot(agdd50$Latitude, agdd50$agdd)
  agdd$doy <- yday(agdd$observed_on)
  # leafdate$phenogen <- paste(leafdate$phenophase, leafdate$lifestage, sep="_")
  plot(yday(agdd$observed_on), agdd$agdd)
  # agdd50 <- agdd50[!agdd50$agdd=="-9999",]
  agdd32$phenogen <- paste(agdd32$phenophase, agdd32$lifestage, sep="_")
  agdd50$phenogen <- paste(agdd50$phenophase, agdd50$lifestage, sep="_")
  
  agdd$adj <- agdd$agdd - 5400 + 115 * as.numeric(agdd$Latitude)
  agdd$adj <- agdd$agdd - -0.6*(as.numeric(agdd$Latitude)-41.5)**3
  plot(yday(agdd$observed_on), agdd$adj)
  plot(agdd$Latitude, agdd$agdd)
  
  # agdd[agdd$lifestage == "Pupa",] <- NA
  # agdd[agdd$lifestage == "Egg",] <- NA
  agdd[agdd$lifestage == "Egg",] <- NA
  
  # for galls with two gens
  agdd$phenogen <- paste(agdd$Gall_generation, agdd$phenophase, agdd$lifestage, sep="_")
  
  #for galls with one gen
  agdd$phenogen <- paste(agdd$phenophase, agdd$lifestage, sep="_")
  boxplot(agdd$agdd~agdd$phenogen, horizontal=T)
  
  
  
  # output the agdd data
  write.csv(agdd, paste0("C:/Users/adam/Downloads/", "aqpet", "agdd.csv"), row.names = FALSE)
  agdd <- read.csv("C:/Users/adam/Downloads/acoo.csv")
  
  # remove rows with invalid agdd
  
  agdd <- agdd[!agdd$agdd=="-9999",]
  # agdd <- agdd[!agdd$phenogen=="unisexual__",]
  # agdd <- agdd[!agdd$phenophase=="oviscar",]
  # agdd <- agdd[!agdd$Host_Plant_ID=="",] # removes rows missing host ID
  # agdd <- agdd[!agdd$Host_Plant_ID=="47851",] # removes rows with host ID marked "oaks"
  # agdd <- agdd[!agdd$Host_Plant_ID=="861033",] # removes rows with host ID marked "white oaks"
  
  # remove rows by id
  # agdd <- agdd[!agdd$id %in% c(''),]
  agdd <- agdd[!is.na(agdd$Longitude),]
  agdd <- agdd[!agdd$phenogen=="unisexual__",]
  agdd <- agdd[!agdd$phenophase=="oviscar",]
  threshold <- 1700
  agdd <- agdd[agdd[,11]>threshold,]
  
  # for galls with two gens
  agdd$phenogen <- gsub("bisexual_developing_Pupa","Sexgen Developing (Pupa)",agdd$phenogen)
  agdd$phenogen <- gsub("bisexual_developing_Larva","Sexgen Developing (Larva)",agdd$phenogen)
  agdd$phenogen <- gsub("bisexual_developing_","Sexgen Developing",agdd$phenogen)
  agdd$phenogen <- gsub("bisexual__Adult","Sexgen Adult",agdd$phenogen)
  agdd$phenogen <- gsub("bisexual_maturing_Adult","Sexgen Emerging",agdd$phenogen)
  agdd$phenogen <- gsub("unisexual_developing_Larva","Agamic Developing (Larva)",agdd$phenogen)
  agdd$phenogen <- gsub("bisexual_developing_","Sexgen Developing",agdd$phenogen)
  agdd$phenogen <- gsub("unisexual_developing_","Agamic Developing",agdd$phenogen)
  agdd$phenogen <- gsub("bisexual_perimature_","Sexgen Perimature",agdd$phenogen)
  agdd$phenogen <- gsub("bisexual_senescent_","Sexgen Senescent",agdd$phenogen)
  
  
  agdd$phenogen <- gsub("unisexual__Adult", "Agamic Adult", agdd$phenogen)
  agdd$phenogen <- gsub("unisexual_maturing_Adult","Agamic Emerging",agdd$phenogen)
  agdd$phenogen <- gsub("unisexual_maturing_","Agamic Emerging",agdd$phenogen)
  agdd$phenogen <- gsub("unisexual_perimature_","Agamic Perimature",agdd$phenogen)
  agdd$phenogen <- gsub("unisexual_oviscar_","Agamic Oviscar",agdd$phenogen)
  agdd$phenogen <- gsub("unisexual_senescent_","Agamic Senescent",agdd$phenogen)
  
  agdd2 <- agdd
  
  # agdd$phenogen <- factor(agdd$phenogen, levels=c("Sexgen Developing", "Sexgen Developing (Larva)", "Sexgen Developing (Pupa)", "Sexgen Emerging", "Sexgen Perimature", "Sexgen Adult","Agamic Oviscar","Agamic Developing","Agamic Developing (Larva)","Agamic Emerging","Agamic Perimature","Agamic Adult", "Agamic Senescent"))
  # agdd$phenogen <- factor(agdd$phenogen, levels=c("Sexgen Developing","Agamic Developing","Agamic Developing (Larva)","Agamic Perimature","Agamic Adult"))
  
  
  agdd$phenogen <- factor(agdd$phenogen, levels=c("Sexgen Developing", "Sexgen Developing (Larva)", "Sexgen Developing (Pupa)", "Sexgen Perimature"))
  agdd$phenogen <- factor(agdd$phenogen, levels=c("Sexgen Developing","Agamic Developing","Agamic Developing (Larva)","Agamic Perimature","Agamic Adult"))
  # 
  
  #for galls with one gen
  agdd$phenogen <- gsub("developing_Larva","Developing (Larva)",agdd$phenogen)
  agdd$phenogen <- gsub("oviscar_","Oviscar",agdd$phenogen)
  agdd$phenogen <- gsub("developing_Adult","Developing (Adult)",agdd$phenogen)
  agdd$phenogen <- gsub("dormant_Larva","Dormant (Larva)",agdd$phenogen)
  agdd$phenogen <- gsub("developing_","Developing",agdd$phenogen)
  agdd$phenogen <- gsub("dormant_", "Dormant", agdd$phenogen)
  agdd$phenogen <- gsub("perimature_","Perimature",agdd$phenogen)
  agdd$phenogen <- gsub("senescent_","Senescent",agdd$phenogen)

  
  # agdd$phenogen <- factor(agdd$phenogen, levels=c("Oviscar","Developing", "Developing (Larva)", "Developing (Pupa)", "Developing (Adult)", "Dormant", "Dormant (Larva)", "Emerging", "Perimature", "Adult","Senescent"))
  # agdd$phenogen <- factor(agdd$phenogen, levels=c("Oviscar", "Developing", "Developing (Adult)", "Dormant", "Dormant (Larva)", "Perimature"))
  
  agdd$phenogen <- factor(agdd$phenogen, levels=c("Oviscar","Developing", "Developing (Larva)", "Developing (Pupa)", "Developing (Adult)", "Dormant", "Dormant (Larva)", "Emerging", "Perimature", "Adult","Senescent"))
  agdd$phenogen <- factor(agdd$phenogen, levels=c("Oviscar", "Developing", "Developing (Adult)", "Dormant", "Dormant (Larva)", "Perimature"))
    agdd <- agdd[!agdd$phenophase=="senescent",]
  # agdd <- agdd[!agdd$phenophase=="oviscar",]
  # plot by phenophase and generation if gall has marked alternating generations
  boxplot(agdd$adj~agdd$phenogen, horizontal=T)
  
  agdd$Host_Plant_ID <- gsub("swamp white oak", "Quercus bicolor",agdd$Host_Plant_ID)
  agdd$Host_Plant_ID <- gsub("white oak", "Quercus alba",agdd$Host_Plant_ID)
  agdd$Host_Plant_ID <- gsub("bur oak", "Quercus macrocarpa",agdd$Host_Plant_ID)
  agdd$Host_Plant_ID <- gsub("119269", "Quercus stellata",agdd$Host_Plant_ID)
  agdd$Host_Plant_ID <- gsub("54780", "Quercus bicolor",agdd$Host_Plant_ID)
  agdd$Host_Plant_ID <- gsub("54779", "Quercus alba",agdd$Host_Plant_ID)
  agdd$Host_Plant_ID <- gsub("54781", "Quercus macrocarpa",agdd$Host_Plant_ID)
  agdd$Host_Plant_ID <- gsub("58726", "Quercus prinoides",agdd$Host_Plant_ID)
  agdd$Host_Plant_ID <- gsub("128686", "Quercus montana",agdd$Host_Plant_ID)
  agdd$Host_Plant_ID <- gsub("82754", "Quercus lyrata",agdd$Host_Plant_ID)
  agdd$Host_Plant_ID <- gsub("54783", "Quercus muehlenbergii",agdd$Host_Plant_ID)
  agdd$Host_Plant_ID <- gsub("371998", "Quercus margarettae",agdd$Host_Plant_ID)
  agdd$Host_Plant_ID <- gsub("167642", "Quercus chapmanii",agdd$Host_Plant_ID)
  agdd$Host_Plant_ID <- gsub("167661", "Quercus oglethorpensis",agdd$Host_Plant_ID)
  agdd$Host_Plant_ID <- gsub("242521", "Quercus sinuata breviloba",agdd$Host_Plant_ID)
  
  
  codes <- c("swamp white oak", "white oak","bur oak","119269","54780","54779","54781","58726","128686","82754","54783","371998","167642","167661","242521")
  binom <- c("Quercus bicolor","Quercus alba","Quercus macrocarpa","Quercus stellata","Quercus bicolor","Quercus alba","Quercus macrocarpa","Quercus prinoides","Quercus montana","Quercus lyrata","Quercus muehlenbergii","Quercus margarettae","Quercus chapmanii","Quercus oglethorpensis","Quercus sinuata breviloba")
  Hostcodes <- as.data.frame(cbind(codes, binom))
  agdd <- merge(agdd, Hostcodes, by.x = Host_Plant_ID, by.y=codes)
  
   
   
  
  
  qmac <- agdd[agdd$Host_Plant_ID=="54781",]
  boxplot(qmac$adj~qmac$phenogen, horizontal=T)
  
  qalb <- agdd[agdd$Host_Plant_ID=="54779",]
  boxplot(qalb$adj~qalb$phenogen, horizontal=T)
  
  qstel <- agdd[agdd$Host_Plant_ID=="119269",]
  boxplot(qstel$adj~qstel$phenogen, horizontal=T)
  
  qbic <- agdd[agdd$Host_Plant_ID=="54780",]
  boxplot(qbic$adj~qbic$phenogen, horizontal=T)
  
  qmar <- agdd[agdd$Host_Plant_ID=="371998",]
  boxplot(qmar$adj~qmar$phenogen, horizontal=T)

  qmue <- agdd[agdd$Host_Plant_ID=="54783",]
  boxplot(qmue$adj~qmue$phenogen, horizontal=T)
  
  qlyr <- agdd[agdd$Host_Plant_ID=="82754",]
  boxplot(qlyr$adj~qlyr$phenogen, horizontal=T)

  qmon <-  agdd[agdd$Host_Plant_ID=="128686",]
  boxplot(qmon$adj~qmon$phenogen, horizontal=T)
  
  