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

prev <- read.csv(paste0(wd, "/USgridagdd.csv" ))

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
percent <- function(comb){
for (i in 1:dim(comb)[1]){
  comb$yearend32[i] <- comb[(comb$doy>355&comb$latitude==comb$latitude[i]&comb$longitude==comb$longitude[i]),5]
  comb$yearend50[i] <- comb[(comb$doy>355&comb$latitude==comb$latitude[i]&comb$longitude==comb$longitude[i]),6]
}

comb$percent32 <- comb$AGDD32/comb$yearend32
comb$percent50 <- comb$AGDD50/comb$yearend50
return(comb)
}
eas <- percent(eas)
comb$daylength <- NULL




prev <- seasonIndex(prev)

easfull <- miss[miss$longitude>-103,]

eas <- prev[prev$longitude>-103,]
eas <- eas[!is.na(eas$AGDD32),]


pac <- miss[!(miss$longitude>-103),]
pac <- pac[!is.na(pac$AGDD32),]

p = ggplot(data = pac, aes(x = seasind, y = percent50, color =doy)) + 
  geom_point() 
p


