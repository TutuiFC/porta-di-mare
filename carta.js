/* LA CARTA — el único archivo que hay que tocar si cambian platos o precios.
   Copiada de la carta real fotografiada en Google Maps (pizzas tradizionali, calzone, suplementos).
   Pendiente de confirmar con el restaurante. Antipasti, pasta y postres: pendientes (no se leen en las fotos). */
window.CARTA = {
  pizzas: [
    { n: "Marinara", p: "10,00", ca: "Tomàquet, all i orenga.", es: "Tomate, ajo y orégano.", en: "Tomato, garlic and oregano." },
    { n: "Margherita", p: "11,00", ca: "Mozzarella i tomàquet.", es: "Mozzarella y tomate.", en: "Mozzarella and tomato." },
    { n: "Napoli", p: "13,00", ca: "Tomàquet, mozzarella, anxoves i orenga.", es: "Tomate, mozzarella, anchoas y orégano.", en: "Tomato, mozzarella, anchovies and oregano." },
    { n: "Parmigiana", p: "13,00", v: true, ca: "Tomàquet, mozzarella, albergínia i parmesà.", es: "Tomate, mozzarella, berenjena y parmesano.", en: "Tomato, mozzarella, aubergine and parmesan." },
    { n: "Baldo 5", p: "13,00", ca: "Tomàquet, mozzarella, pesto i tonyina.", es: "Tomate, mozzarella, pesto y atún.", en: "Tomato, mozzarella, pesto and tuna." },
    { n: "Tonno", p: "13,50", ca: "Tomàquet, mozzarella i tonyina.", es: "Tomate, mozzarella y atún.", en: "Tomato, mozzarella and tuna." },
    { n: "Romanaccia", p: "14,00", ca: "Tomàquet, mozzarella, tonyina i ceba.", es: "Tomate, mozzarella, atún y cebolla.", en: "Tomato, mozzarella, tuna and onion." },
    { n: "Mac II", p: "14,00", v: true, ca: "Tomàquet, formatge stracchino, espinac, rave, albergínia i carbassó.", es: "Tomate, queso stracchino, espinaca, rábano, berenjena y calabacín.", en: "Tomato, stracchino cheese, spinach, radish, aubergine and courgette." },
    { n: "4 Formaggi", p: "14,50", ca: "Tomàquet, mozzarella, taleggio, scamorza i gorgonzola.", es: "Tomate, mozzarella, taleggio, scamorza y gorgonzola.", en: "Tomato, mozzarella, taleggio, scamorza and gorgonzola." },
    { n: "Jordi II", p: "15,50", ca: "Tomàquet, mozzarella de búfala, tomàquets semisecs i alfàbrega.", es: "Tomate, mozzarella de búfala, tomates semisecos y albahaca.", en: "Tomato, buffalo mozzarella, semi-dried tomatoes and basil." },
    { n: "Cestino di Wilma", p: "16,00", ca: "Tomàquet, mozzarella, albergínia, tomàquets semisecs i mozzarella de búfala.", es: "Tomate, mozzarella, berenjena, tomates semisecos y mozzarella de búfala.", en: "Tomato, mozzarella, aubergine, semi-dried tomatoes and buffalo mozzarella." }
  ],
  calzone: [
    { n: "Calzone", p: "13,50", ca: "Tomàquet, mozzarella i pernil dolç.", es: "Tomate, mozzarella y jamón cocido.", en: "Tomato, mozzarella and cooked ham." },
    { n: "Calzone farcito", p: "14,50", ca: "Tomàquet, mozzarella, xampinyons, carxofes, olives i pernil dolç.", es: "Tomate, mozzarella, champiñones, alcachofas, olivas y jamón cocido.", en: "Tomato, mozzarella, mushrooms, artichokes, olives and cooked ham." },
    { n: "Calzone Aiur", p: "16,50", ca: "Tomàquet, mozzarella, formatge de cabra, ou i rosbif.", es: "Tomate, mozzarella, queso de cabra, huevo y rosbif.", en: "Tomato, mozzarella, goat's cheese, egg and roast beef." }
  ],
  suplementos: [
    { p: "1,50", ca: "Massa negra (carbó)", es: "Masa negra (carbón)", en: "Black (charcoal) dough" },
    { p: "3,00", ca: "Massa sense gluten", es: "Masa sin gluten", en: "Gluten-free dough" },
    { p: "1,50", ca: "Massa integral", es: "Masa integral", en: "Wholemeal dough" },
    { p: "2,50", ca: "Peix, carn, embotits o bolets", es: "Pescado, carne, embutidos o setas", en: "Fish, meat, cured meats or mushrooms" },
    { p: "4,00", ca: "Tòfona negra", es: "Trufa negra", en: "Black truffle" },
    { p: "1,00", ca: "Altres ingredients", es: "Otros ingredientes", en: "Other toppings" }
  ]
};
