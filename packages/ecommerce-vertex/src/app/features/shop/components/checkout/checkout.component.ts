import type { OnInit } from '@angular/core';
import { Component, inject, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import type { FormGroup, AbstractControl } from '@angular/forms';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import type { WithFieldValue } from '@angular/fire/firestore';
import { OrderSummaryComponent } from './components/order-summary/order-summary.component';
import { CartService } from '@core/services/cart.service';
import type { CartItem } from '@core/models/cart.model';
import { PaymentService } from '@core/services/payment.service';
import { SweetAlertService } from '@core/services/sweet-alert.service';
import { OrderService } from '@core/services/order.service';
import type { Order, OrderItem } from '@core/models/order.model';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, OrderSummaryComponent],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutComponent implements OnInit {
  private fb = inject(FormBuilder);
  cartService = inject(CartService);
  private paymentService = inject(PaymentService);
  private sweetAlertService = inject(SweetAlertService);
  private orderService = inject(OrderService);
  private router = inject(Router);

  checkoutForm!: FormGroup;
  isProcessingPayment = signal(false);

  ngOnInit(): void {
    this.checkoutForm = this.fb.group({
      contactInfo: this.fb.group({
        firstName: ['', [Validators.required, Validators.minLength(2)]],
        lastName: ['', [Validators.required, Validators.minLength(2)]],
        email: ['', [Validators.required, Validators.email]],
        phone: [
          '',
          [Validators.required, Validators.pattern('^[+]*[(]{0,1}[0-9]{1,4}[)]{0,1}[-s./0-9]*$')],
        ],
      }),
      shippingInfo: this.fb.group({
        address: ['', [Validators.required, Validators.minLength(5)]],
        city: ['', [Validators.required, Validators.minLength(3)]],
        zipCode: ['', [Validators.required, Validators.pattern('^[a-zA-Z0-9- ]{3,10}$')]],
        province: ['', [Validators.required, Validators.minLength(4)]],
      }),
    });
  }

  get contactControls(): { [key: string]: AbstractControl } {
    return (this.checkoutForm.get('contactInfo') as FormGroup).controls;
  }
  get shippingControls(): { [key: string]: AbstractControl } {
    return (this.checkoutForm.get('shippingInfo') as FormGroup).controls;
  }

  async onSubmit(): Promise<void> {
    if (this.checkoutForm.invalid) {
      this.checkoutForm.markAllAsTouched();
      this.sweetAlertService.error(
        'Formulario Incompleto',
        'Por favor, completa todos los campos requeridos.'
      );
      return;
    }

    this.isProcessingPayment.set(true);
    this.sweetAlertService.loading('Preparando tu pago...', 'Por favor, espera.');

    const cart = this.cartService.cart();

    if (!cart || cart.items.length === 0) {
      this.sweetAlertService.error('Carrito Vacío', 'No puedes proceder al pago sin productos.');
      this.isProcessingPayment.set(false);
      void this.router.navigate(['/shop/cart']);
      return;
    }

    try {
      const orderId = await this.createOrder(cart.items, cart.total);
      const paymentResult = await this.paymentService.initiatePayment(cart.items, orderId);

      if (paymentResult.success && paymentResult.init_point) {
        this.cartService.clearCart();
        window.location.href = paymentResult.init_point;
      } else {
        throw new Error(paymentResult.error ?? 'No se pudo obtener la URL de pago.');
      }
    } catch (error: unknown) {
      console.error('Error en el proceso de checkout:', error);

      let errorMessage = 'Ocurrió un error inesperado al procesar tu pago.';
      const err = error as { code?: string; message?: string };
      if (err.code === 'resource-exhausted' || (err.message ?? '').includes('insuficiente')) {
        errorMessage = `¡Stock insuficiente! ${err.message}. Por favor, revisa tu carrito.`;
      } else if ((err.message ?? '').includes('precio inválido')) {
        errorMessage = `Uno de los productos en tu carrito tiene un precio inválido. Por favor, revisa tu carrito.`;
      }

      this.sweetAlertService.error('Pago Rechazado', errorMessage);
      this.isProcessingPayment.set(false);
    }
  }

  private async createOrder(cartItems: CartItem[], total: number): Promise<string> {
    const { contactInfo, shippingInfo } = this.checkoutForm.value;

    const orderItems: OrderItem[] = cartItems.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      productName: item.name,
      quantity: item.quantity,
      price: item.price,
      productImage: item.image ?? '',
      attributes: item.attributes,
    }));

    const newOrder: WithFieldValue<Omit<Order, 'id'>> = {
      userId: 'anonymous-user',
      clientName: `${contactInfo.firstName} ${contactInfo.lastName}`,
      clientEmail: contactInfo.email,
      clientPhone: contactInfo.phone,
      orderDate: new Date(),
      total,
      status: 'pending',
      items: orderItems,
      shippingAddress: {
        street: shippingInfo.address,
        city: shippingInfo.city,
        state: shippingInfo.province,
        zipCode: shippingInfo.zipCode,
        country: 'Argentina',
      },
      paymentDetails: {
        paymentMethod: 'Mercado Pago',
        subtotal: total,
        shippingCost: 0,
        taxAmount: 0,
      },
      stockDecremented: false,
    };

    try {
      const orderRef = await this.orderService.createOrder(newOrder);
      return orderRef.id;
    } catch (error) {
      console.error('Error al guardar el pedido:', error);
      throw new Error('No pudimos registrar tu pedido. Intenta de nuevo.');
    }
  }
}
