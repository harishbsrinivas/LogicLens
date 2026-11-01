package shop.orders;

import java.math.BigDecimal;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

public final class OrderService {
    public record Line(String sku, int quantity, BigDecimal unitPrice) {}

    public record Order(String id, String customerId, List<Line> lines, Status status) {
        public BigDecimal total() {
            return lines.stream()
                .map(l -> l.unitPrice().multiply(BigDecimal.valueOf(l.quantity())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        }
    }

    public enum Status { NEW, PAID, SHIPPED, CANCELLED }

    public interface OrderRepository {
        Optional<Order> find(String id);
        void save(Order order);
    }

    public interface PaymentGateway {
        boolean charge(String customerId, BigDecimal amount);
    }

    private final OrderRepository orders;
    private final PaymentGateway payments;

    public OrderService(OrderRepository orders, PaymentGateway payments) {
        this.orders = Objects.requireNonNull(orders);
        this.payments = Objects.requireNonNull(payments);
    }

    public Order pay(String orderId) {
        Order order = orders.find(orderId)
            .orElseThrow(() -> new IllegalArgumentException("unknown order " + orderId));
        if (order.status() != Status.NEW) {
            throw new IllegalStateException("order is " + order.status());
        }
        if (!payments.charge(order.customerId(), order.total())) {
            throw new IllegalStateException("payment declined");
        }
        Order paid = new Order(order.id(), order.customerId(), order.lines(), Status.PAID);
        orders.save(paid);
        return paid;
    }

    public Order cancel(String orderId) {
        Order order = orders.find(orderId).orElseThrow();
        if (order.status() == Status.SHIPPED) {
            throw new IllegalStateException("already shipped");
        }
        Order cancelled = new Order(order.id(), order.customerId(), order.lines(), Status.CANCELLED);
        orders.save(cancelled);
        return cancelled;
    }
}
