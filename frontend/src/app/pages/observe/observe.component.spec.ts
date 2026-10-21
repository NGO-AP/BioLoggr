import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ObserveComponent } from './observe.component';

describe('ObserveComponent', () => {
  let component: ObserveComponent;
  let fixture: ComponentFixture<ObserveComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ObserveComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ObserveComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should handle file selection and generate preview', () => {
    const file = new File(['dummy content'], 'test.png', { type: 'image/png' });
    const event = {
      target: {
        files: [file]
      }
    } as unknown as Event;

    // Call protected method via casting
    (component as any).onFileSelected(event);
    fixture.detectChanges();

    expect((component as any).selectedFile()).toBe(file);
  });
});
