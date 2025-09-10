import requests

# api url
url = "https://restapi.amap.com/v3/direction/walking"

# pram
params = {
    "key": "15545d45ce8a292c2f0b1ae93f9d914b",  # 你提供的高德 API Key
    "origin": "116.481028,39.989643",           # 出发点经纬度（格式：经度,纬度）
    "destination": "116.434446,39.90816"        # 目的地经纬度（格式：经度,纬度）
}

# get
response = requests.get(url, params=params)

# print
result = response.json()
print(result)