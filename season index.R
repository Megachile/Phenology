library(solrad)
install.packages("insol")
library(insol)
library(units)
library(stats)
library(pracma)
comb$daylength <- 2*acos(cos(set_units(90.833, "radians"))/(cos(set_units(comb$latitude, "radians"))*cos(set_units(Declination(comb$doy),"radians"))) - tan )/15

daylength <- 2*ha/15

thr <- 10.5
lat <- 45



eq = function(x,lat=45) {(2*(24/(2*pi))*acos(-tan((lat*pi/180))*tan((pi*Declination(x)/180))))-9}
ah <- function(x, lat)

# 
# x <- seq(0,250)
# y <- eq(x,lat,thr)
# x <- data

eas1 <- seasonIndex(eas1)
data1 <- seasonIndex(data)
x <- data
y <- eas1

x <- data
y <- eas1



x <- data1
y <- doyLatPercentEq(data1,eas1)
y <- doyLatSeasEq(data1,eas1)

p = ggplot(data = x, aes(x = doy, y = latitude, color=phenophase, shape=phenophase,size=22)) + 
  geom_point()+
  geom_abline(intercept = y$lowyint[1], slope=y$lowslope[1], color="#E41A1C")+
  geom_abline(intercept = y$highyint[1], slope=y$highslope[1], color="#E41A1C")
p


doyLatPlot(data1, y)

plot(data1$percent50~data1$seasind)



ggplot(data.frame(x=c(1, 365)), aes(x=x)) + 
  stat_function(fun=insol)


eq(c(1,2,3,4,5,6),45)

insol(52,45,-100)

insol <- function(doy, lat=45, long=-100){
 insolation(acos(sin(lat*pi/180)*sin(Declination(doy)*pi/180)+cos(lat*pi/180)*cos(Declination(doy)*pi/180)*cos(hourangle(doy,long,-9)*pi/180)),doy,1500,28,60,278.15,0.3,0.2)[1]
}

insol <- function(x){
  insolation(acos(sin(x$latitude*pi/180)*sin(Declination(x$doy)*pi/180)+cos(x$latitude*pi/180)*cos(Declination(x$doy)*pi/180)*cos(hourangle(x$doy,long,-9)*pi/180)),x$doy,3000,28,60,278.15,0.3,0.2)
}


x <- eas1
insol(x$doy[1],x$latitude[1],x$longitude[1])

insolPercent <- function(x){
  
  for (i in 1:dim(x)[1]){
    x$insolPercent[i] <- trapz(seq(1,x$doy[i]),insol(seq(1,x$doy[i]),x$latitude[i],x$longitude[i]))/trapz(seq(1,365),insol(seq(1,365),x$latitude[i],x$longitude[i]))
  }
  return(x)
}

eas1 <- insolPercent(eas1)
