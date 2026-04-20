import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { AuthService } from '../../../../core/services/auth/authService';
import { CommonModule } from '@angular/common';
import { take } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    NzFormModule,
    NzInputModule,
    NzButtonModule,
    NzIconModule,
    NzCheckboxModule
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private notification = inject(NzNotificationService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  loading = signal(false);
  passwordVisible = signal(false);

  loginForm: FormGroup = this.fb.group({
    nombreUsuario: ['', Validators.required],
    password: ['', Validators.required],
    recordar: [false]
  });

  togglePassword(): void {
    this.passwordVisible.update(v => !v);
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      Object.values(this.loginForm.controls).forEach(c => {
        c.markAsDirty();
        c.updateValueAndValidity();
      });
      return;
    }

    this.loading.set(true);
    const { nombreUsuario, password } = this.loginForm.value;

    this.authService.login({ nombreUsuario, password }).pipe(take(1)).subscribe({
      next: (success) => {
        this.loading.set(false);
        if (success) {
          this.notification.success('Bienvenido', 'Sesión iniciada correctamente');
          // Si veniamos de un deep-link (?returnUrl=/v/xxx), volvemos allí.
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
          this.router.navigateByUrl(returnUrl && returnUrl.startsWith('/') ? returnUrl : '/dashboard');
        }
      },
      error: () => {
        this.loading.set(false);
        this.notification.error('Error', 'Credenciales inválidas');
      }
    });
  }
}

