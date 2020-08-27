import { Component, OnInit } from '@angular/core';

import { VimpApiService } from './vimp-api.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'VIMP-client';
  input = ["", ""];
  output = "null";

  constructor(private vimpApiService: VimpApiService) {}

  ngOnInit() {}

  onSubmit(request) {
    if (request.localeCompare("getVendorDetails") == 0) {
      this.vimpApiService
          .getVendorDetails(this.input[0])
          .subscribe(
            res => {
              this.output = JSON.stringify({
                "vendor-name": res.split('\n')[0],
                "vendor-state": res.split('\n')[1]
              }, null, 2);
            }, err => {console.log(err.message);}
          );
    }
    else if (request.localeCompare("getVendorIdMap") == 0) {
      this.vimpApiService
          .getVendorIdMap(this.input[0])
          .subscribe(
            res => {
              this.output = JSON.stringify(res, null, 2);
            }, err => {console.log(err.message);}
          );
    }
    else if (request.localeCompare("putVendorIdMap") == 0) {
      this.vimpApiService
          .putVendorIdMap(this.input[0], this.input[1])
          .subscribe(
            res => {this.output = res;},
            err => {console.log(err.message);}
          );
    }
    else this.output = "null";
  }

}
