# str(eas)
# eas <- eas[,-c(1:3)]
# eas <- eas[,-c(4:5)]
# eas <- eas[,-c(1)]
# eas <- eas[,-c(6:9)]
# eas <- eas[eas$doy<366,]
# table(eas$longitude)
table(eas$latitude)
# table(y$doy)

unique_doy <- unique(eas$doy)
unique_longitude <- unique(eas$longitude)
new_latitudes <- expand.grid(latitude = c(21, 19, 17, 15, 13, 11, 9, 7, 5, 3, 1), longitude = unique(eas$longitude), doy = unique(eas$doy))
# new_latitudes <- expand.grid(latitude = c(15, 13, 11), longitude = unique(eas$longitude), doy = unique(eas$doy))
# new_latitudes <- expand.grid(latitude = c(21, 19, 17), longitude = unique(eas$longitude), doy = unique(eas$doy))
# new_latitudes <- expand.grid(latitude = c(27, 25, 23), longitude = unique(eas$longitude), doy = unique(eas$doy))
# new_latitudes <- expand.grid(latitude = c(51, 53, 55), longitude = unique(eas$longitude), doy = unique(eas$doy))
new_latitudes <- expand.grid(latitude = c(57, 59, 61, 63, 65), longitude = unique(eas$longitude), doy = unique(eas$doy))
new_latitudes$seasind <- NA
new_latitudes$acchours <- NA
eas <- rbind(eas, new_latitudes)

for (i in 1:dim(x)[1]){
  x$seasind[i] <- trapz(seq(1,x$doy[i]),(pos_part(eq(seq(1,x$doy[i]),x$latitude[i]))))/trapz(seq(1,(365)),(pos_part(eq(seq(1,(365)),x$latitude[i]))))
}

for(i in 1:nrow(eas)) {
  if(is.na(eas$seasind[i])) {
    eas$seasind[i] <- trapz(seq(1,eas$doy[i]),(pos_part(eq(seq(1,eas$doy[i]),eas$latitude[i]))))/trapz(seq(1,(365)),(pos_part(eq(seq(1,(365)),eas$latitude[i]))))
  }
  if(is.na(eas$acchours[i])) {
    eas$acchours[i] <- trapz(
      seq(1,eas$doy[i]),
      (pos_part(eqmod(seq(1,eas$doy[i]),eas$latitude[i])*(90-eas$latitude[i]))
       /max(eqmod(seq(1,365),eas$latitude[i])) * (-1/200*eas$latitude[i]+647/600) ))
  }}
