import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class VimpApiService {

  private VIMP_API_SERVER = "https://hi7t1485il.execute-api.us-east-2.amazonaws.com/prod";

  constructor(private httpClient: HttpClient) { }

  public getVendorDetails(vendorIdWfm) {
    const url = `${this.VIMP_API_SERVER}/vendor-id-wfm/${vendorIdWfm}`;
    return this.httpClient.get(url, {responseType: "text"});
  }

  public getVendorIdMap(vendorIdWfm) {
    const url = `${this.VIMP_API_SERVER}/vendor-id-map/${vendorIdWfm}`;
    return this.httpClient.get(url);
  }

  public putVendorIdMap(vendorIdWfm, vendorIdAmz) {
    const url = `${this.VIMP_API_SERVER}/vendor-id-map`;
    return this.httpClient.put(url, {
      "vendor-id-wfm": vendorIdWfm,
      "vendor-id-amz": vendorIdAmz
    }, {responseType: "text"});
  }
}
