latitude <- seq(15, 55, 1)
longitude <- seq(-120,-75, 1)
doy <- seq(1,364,1)
miss <- expand.grid(latitude, longitude, doy)
miss <- setnames(miss, old = c('Var1','Var2','Var3'), new=c('latitude','longitude','doy'))
miss <- seasonIndex(miss)



US <- US[!US$AGDD32=="-9999",]
US$doy <- as.numeric(US$doy)

p = ggplot(data = comb, aes(x = doy, y = AGDD32)) + 
  geom_point() 
p

max(comb$doy)
tf <- eas[which(between(eas$AGDD32,1380-2*281,1450-2*281)),]

# tf <- tf[yday(tf$observed_on)<275,]

p = ggplot(data = miss, aes(x = seasind, y = latitude,)) + 
  geom_point()
p


write.csv(miss,paste0(wd, "/NAgridSeas.csv" ))



names(prev)
prev$X <- NULL
prev <- prev[!is.na(prev$latitude),]
names(prev)[names(prev)=="observed_on"] <- "date"

US$doy <- NULL

comb <- merge(US, prev, by =c("date","longitude","latitude"), all.x=TRUE)
comb$doy <- yday(comb$date)

comb <- rbind(comb, miss)

unique(comb[,c('latitude','longitude')])
max(comb)
comb$yearend32 <- NA
comb$yearend50 <- NA

comb <- prev
for (i in 1:dim(comb)[1]){
  comb$yearend32[i] <- comb[(comb$doy>355&comb$latitude==comb$latitude[i]&comb$longitude==comb$longitude[i]),5]
  comb$yearend50[i] <- comb[(comb$doy>355&comb$latitude==comb$latitude[i]&comb$longitude==comb$longitude[i]),6]
}

comb$percent32 <- comb$AGDD32/comb$yearend32
comb$percent50 <- comb$AGDD50/comb$yearend50

comb$daylength <- NULL




prev <- seasonIndex(comb)
prev <- acchours(prev)
year <- unique(prev[c("doy","latitude","longitude")])
twenty <- year
twenty$date <- as.Date(twenty$doy, origin = "2015-12-31")
twenty$observed_on <- NULL
names(twenty)[names(twenty)=="date"] <- "observed_on"

twenty$country <- "USA"
twenty <- lookUpAGDD(twenty)
twenty <- twenty[!is.na(twenty$AGDD32),]
twenty <- seasonIndex(twenty)
twenty <- acchours(twenty)
twenty[,"country"] <- NULL
prev <- rbind(prev,twenty)

write.csv(prev, paste0(wd, "/USgridagdd.csv"))
prev <- read.csv(paste0(wd, "/USgridagdd.csv" ))

prev[prev$doy>365,"acchours"] <- NA

# 
# for (i in 1:dim(prev)[1]){
#   prev[i+35298,] <- prev[i,]
#   prev$doy[i+35298] <- prev$doy[i]+365
#   prev$seasind[i+35298] <- prev$seasind[i]+1
#   prev$acchours[i+35298] <- NA
# }

plot(eas$doy~eas$seasind)



prev <- seasonIndex(prev)
prev <- acchours(prev)

easfull <- prev[prev$longitude>-103,]
eas <- easfull[!is.na(easfull$AGDD32),]


str(prev$date)   
for (i in 1:dim(prev)[1]) {
if (!grepl("-", prev$date[i])){
      prev$date[i] <- as.character(as.Date(as.numeric(prev$date[i]), origin = as.Date("1970-01-01")))
}
     }


pac <- miss[!(miss$longitude>-103),]
pac <- pac[!is.na(pac$AGDD32),]



thr <- 0.75
tf <- eas[which(between(eas$seasind,thr,thr+0.04)),]
p = ggplot(data = tf, aes(x = doy, y = latitude, color =seasind)) + 
  geom_point() 
p

mod <- lm(tf$latitude~tf$doy)
plot(tf$latitude~tf$doy)

