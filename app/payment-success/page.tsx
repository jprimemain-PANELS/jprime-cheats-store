"use client";

import { useEffect }
from "react";

export default function PaymentSuccessPage() {

  useEffect(() => {

    processPayment();

  }, []);

  async function processPayment() {

    try {

      const params =
        new URLSearchParams(
          window.location.search
        );

      const product =
        params.get("product");

      const duration =
        params.get("duration");

      console.log(
        "PRODUCT:",
        product
      );

      console.log(
        "DURATION:",
        duration
      );

      const response =
        await fetch(
          "/api/get-key",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({

              product_name:
                product,

              duration:
                duration,
            }),
          }
        );

      const data =
        await response.json();

      console.log(
        "GET KEY RESPONSE:",
        data
      );

      if (data.success) {

        const currentUser =
          JSON.parse(
            localStorage.getItem(
              "user"
            ) || "{}"
          );

        console.log(
          "CURRENT USER:",
          currentUser
        );

        const saveResponse =
          await fetch(
            "/api/save-purchase",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({

                username:
                  currentUser.username,

                product_name:
                  data.product_name,

                duration:
                  data.duration,

                key_code:
                  data.key,
              }),
            }
          );

        const saveData =
          await saveResponse.json();

        console.log(
          "SAVE PURCHASE:",
          saveData
        );

        localStorage.setItem(
          "latest_key",
          data.key
        );

        window.location.href =
          "/";
      }

    } catch (error) {

      console.log(
        "PAYMENT ERROR:",
        error
      );
    }
  }

  return null;
}