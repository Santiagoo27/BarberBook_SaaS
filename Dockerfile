FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY BarberBookSaaS.Domain/*.csproj BarberBookSaaS.Domain/
COPY BarberBookSaaS.Application/*.csproj BarberBookSaaS.Application/
COPY BarberBookSaaS.Infrastructure/*.csproj BarberBookSaaS.Infrastructure/
COPY BarberBookSaaS.WebApi/*.csproj BarberBookSaaS.WebApi/
RUN dotnet restore BarberBookSaaS.WebApi/BarberBookSaaS.WebApi.csproj

COPY BarberBookSaaS.Domain/ BarberBookSaaS.Domain/
COPY BarberBookSaaS.Application/ BarberBookSaaS.Application/
COPY BarberBookSaaS.Infrastructure/ BarberBookSaaS.Infrastructure/
COPY BarberBookSaaS.WebApi/ BarberBookSaaS.WebApi/
RUN dotnet publish BarberBookSaaS.WebApi/BarberBookSaaS.WebApi.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/publish .
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENTRYPOINT ["dotnet", "BarberBookSaaS.WebApi.dll"]
