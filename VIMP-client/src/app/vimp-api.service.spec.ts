import { TestBed } from '@angular/core/testing';

import { VimpApiService } from './vimp-api.service';

describe('VimpApiService', () => {
  let service: VimpApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(VimpApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
